import { http, HttpResponse } from 'msw';

import oauthToken from '@/api/fixtures/oauth.token.json';
import type { Env } from '@/lib/env';
import { API, server } from '@/test/msw';

import {
  AuthConfigError,
  buildAuthorizeUrl,
  createMemoryTokenStore,
  exchangeCode,
  isExpiring,
  OAuthError,
  parseAuthorizationResponse,
  AUTH_DISCOVERY,
  refreshToken,
  secureTokenStore,
  tokenSetFromResponse,
  type TokenSet,
} from './auth';
import { ApiError } from './errors';

const PROXY = 'https://token-proxy.example.workers.dev/token';
const baseEnv: Env = { tumblrApiKey: 'consumer-key', appVersion: '1.0.0', isTest: true };
const now = () => 1_000_000;

function captureTokenRequests(url: string) {
  const bodies: Record<string, unknown>[] = [];
  server.use(
    http.post(url, async ({ request }) => {
      bodies.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json(oauthToken);
    }),
  );
  return bodies;
}

describe('exchangeCode', () => {
  it('posts to the proxy without a client secret', async () => {
    const bodies = captureTokenRequests(PROXY);
    const tokens = await exchangeCode('the-code', 'tumblrgallery://auth/callback', {
      env: { ...baseEnv, tokenExchangeUrl: PROXY, tumblrClientSecret: 'ignored' },
      now,
    });
    expect(bodies[0]).toEqual({
      grant_type: 'authorization_code',
      code: 'the-code',
      redirect_uri: 'tumblrgallery://auth/callback',
      client_id: 'consumer-key',
    });
    expect(tokens).toEqual({
      accessToken: oauthToken.access_token,
      refreshToken: oauthToken.refresh_token,
      expiresAt: 1_000_000 + 2520 * 1000,
      scope: 'basic write offline_access',
    });
  });

  it('falls back to Tumblr directly with the dev secret', async () => {
    const bodies = captureTokenRequests(`${API}/v2/oauth2/token`);
    await exchangeCode('c', 'r', { env: { ...baseEnv, tumblrClientSecret: 'dev-secret' } });
    expect(bodies[0]).toMatchObject({ client_secret: 'dev-secret', client_id: 'consumer-key' });
  });

  it('throws a clear error when neither proxy nor secret is configured', async () => {
    await expect(exchangeCode('c', 'r', { env: baseEnv })).rejects.toBeInstanceOf(AuthConfigError);
    await expect(exchangeCode('c', 'r', { env: baseEnv })).rejects.toThrow(
      /EXPO_PUBLIC_TOKEN_EXCHANGE_URL/,
    );
  });

  it('accepts an enveloped proxy response', async () => {
    server.use(
      http.post(PROXY, () =>
        HttpResponse.json({ meta: { status: 200, msg: 'OK' }, response: oauthToken }),
      ),
    );
    const tokens = await exchangeCode('c', 'r', { env: { ...baseEnv, tokenExchangeUrl: PROXY } });
    expect(tokens.accessToken).toBe(oauthToken.access_token);
  });

  it('maps OAuth errors to ApiError', async () => {
    server.use(
      http.post(PROXY, () =>
        HttpResponse.json(
          { error: 'invalid_grant', error_description: 'code expired' },
          { status: 400 },
        ),
      ),
    );
    await expect(
      exchangeCode('c', 'r', { env: { ...baseEnv, tokenExchangeUrl: PROXY } }),
    ).rejects.toMatchObject({ status: 400, code: 'invalid_grant', detail: 'code expired' });
  });
});

describe('refreshToken', () => {
  const env = { ...baseEnv, tokenExchangeUrl: PROXY };

  it('sends the refresh grant and keeps the old refresh token if none is rotated', async () => {
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.post(PROXY, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ access_token: 'new', expires_in: 2520 });
      }),
    );
    const tokens = await refreshToken('old-rt', { env, now });
    expect(bodies[0]).toMatchObject({ grant_type: 'refresh_token', refresh_token: 'old-rt' });
    expect(tokens).toMatchObject({ accessToken: 'new', refreshToken: 'old-rt' });
  });

  it('rejects with a 401 ApiError when the refresh token is dead', async () => {
    server.use(
      http.post(PROXY, () => HttpResponse.json({ error: 'invalid_grant' }, { status: 401 })),
    );
    const error = await refreshToken('dead', { env }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401, message: 'Refresh token is no longer valid' });
  });
});

describe('token helpers', () => {
  const tokens: TokenSet = { accessToken: 'a', expiresAt: 100_000 };

  it.each([
    [0, false],
    [39_999, false],
    [40_000, true],
    [200_000, true],
  ])('isExpiring at %i → %p', (at, expected) => expect(isExpiring(tokens, at)).toBe(expected));

  it('computes expiresAt from expires_in', () => {
    expect(tokenSetFromResponse({ access_token: 'x', expires_in: 10 }, 5).expiresAt).toBe(10_005);
  });

  it('builds the authorize URL with scopes, state and redirect', () => {
    const url = new URL(buildAuthorizeUrl('xyz', 'tumblrgallery://auth/callback', baseEnv));
    expect(url.origin + url.pathname).toBe('https://www.tumblr.com/oauth2/authorize');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'consumer-key',
      response_type: 'code',
      scope: 'basic write offline_access',
      state: 'xyz',
      redirect_uri: 'tumblrgallery://auth/callback',
    });
  });
});

describe('token stores', () => {
  it.each([
    ['memory', createMemoryTokenStore()],
    ['secure (jest memory impl)', secureTokenStore],
  ])('%s store round-trips and clears', async (_name, store) => {
    const tokens: TokenSet = { accessToken: 'a', refreshToken: 'r', expiresAt: 1 };
    await store.save(tokens);
    await expect(store.load()).resolves.toEqual(tokens);
    await store.clear();
    await expect(store.load()).resolves.toBeNull();
  });
});

describe('parseAuthorizationResponse', () => {
  it('returns the code when state matches', () => {
    expect(parseAuthorizationResponse({ code: 'abc', state: 's1' }, 's1')).toBe('abc');
  });

  it.each([
    ['state_mismatch', { code: 'abc', state: 'other' }],
    ['state_mismatch', { code: 'abc' }],
    ['access_denied', { error: 'access_denied', state: 's1' }],
    ['provider_error', { error: 'server_error', error_description: 'boom', state: 's1' }],
    ['missing_code', { state: 's1' }],
  ] as const)('throws %s', (code, params) => {
    expect(() => parseAuthorizationResponse(params, 's1')).toThrow(OAuthError);
    try {
      parseAuthorizationResponse(params, 's1');
    } catch (error) {
      expect((error as OAuthError).code).toBe(code);
    }
  });

  it('exposes the Tumblr discovery document', () => {
    expect(AUTH_DISCOVERY).toEqual({
      authorizationEndpoint: 'https://www.tumblr.com/oauth2/authorize',
      tokenEndpoint: 'https://api.tumblr.com/v2/oauth2/token',
    });
  });
});
