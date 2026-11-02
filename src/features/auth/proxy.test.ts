import { OAUTH_REDIRECT_URI } from '@/api/auth';
import oauthToken from '@/api/fixtures/oauth.token.json';
// The Worker is a standalone package; it is exercised here so CI covers it.
import {
  handleRequest,
  parseGrant,
  RATE_LIMIT,
  resetRateLimits,
  TUMBLR_TOKEN_URL,
  type Env,
} from '../../../proxy/src/index';

const env: Env = {
  TUMBLR_CLIENT_ID: 'consumer-key',
  TUMBLR_CLIENT_SECRET: 'super-secret',
  ALLOWED_REDIRECT_URIS: OAUTH_REDIRECT_URI,
};

function tokenRequest(body: unknown, init: RequestInit = {}): Request {
  return new Request('https://proxy.example/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '1.2.3.4' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    ...init,
  });
}

function upstreamOk() {
  const calls: { url: string; body: URLSearchParams }[] = [];
  const fetchImpl = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: new URLSearchParams(String(init?.body)) });
    return new Response(JSON.stringify(oauthToken), { status: 200 });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

beforeEach(() => resetRateLimits());

describe('token proxy', () => {
  it('adds the secret to an authorization_code grant and relays the answer', async () => {
    const { calls, fetchImpl } = upstreamOk();
    const response = await handleRequest(
      tokenRequest({
        grant_type: 'authorization_code',
        code: 'abc',
        redirect_uri: OAUTH_REDIRECT_URI,
        client_id: 'ignored-by-proxy',
      }),
      env,
      { fetchImpl },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(oauthToken);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(calls[0]?.url).toBe(TUMBLR_TOKEN_URL);
    expect(Object.fromEntries(calls[0]?.body ?? [])).toEqual({
      grant_type: 'authorization_code',
      code: 'abc',
      redirect_uri: OAUTH_REDIRECT_URI,
      client_id: 'consumer-key',
      client_secret: 'super-secret',
    });
  });

  it('forwards refresh grants and uses the body client_id when none is configured', async () => {
    const { calls, fetchImpl } = upstreamOk();
    await handleRequest(
      tokenRequest({ grant_type: 'refresh_token', refresh_token: 'r1', client_id: 'from-app' }),
      { TUMBLR_CLIENT_SECRET: 's' },
      { fetchImpl },
    );
    expect(Object.fromEntries(calls[0]?.body ?? [])).toMatchObject({
      grant_type: 'refresh_token',
      refresh_token: 'r1',
      client_id: 'from-app',
      client_secret: 's',
    });
  });

  it('rejects other grant types without calling Tumblr', async () => {
    const { fetchImpl } = upstreamOk();
    const response = await handleRequest(
      tokenRequest({ grant_type: 'password', username: 'u', password: 'p' }),
      env,
      { fetchImpl },
    );
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: string }).error).toBe('unsupported_grant_type');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    [{ grant_type: 'authorization_code', code: 'x' }],
    [{ grant_type: 'refresh_token' }],
    ['not json'],
  ])('rejects malformed input %j', async (body) => {
    const { fetchImpl } = upstreamOk();
    const response = await handleRequest(tokenRequest(body), env, { fetchImpl });
    expect(response.status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each(['https://evil', 'tumblrgallery://auth/callback'])(
    'rejects redirect URIs outside the allow-list (%s)',
    async (redirectUri) => {
      const { fetchImpl } = upstreamOk();
      const response = await handleRequest(
        tokenRequest({ grant_type: 'authorization_code', code: 'x', redirect_uri: redirectUri }),
        env,
        { fetchImpl },
      );
      expect(response.status).toBe(400);
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it('ships a wrangler.toml allow-list matching the app callback URL', () => {
    const fs = jest.requireActual<typeof import('fs')>('fs');
    const path = jest.requireActual<typeof import('path')>('path');
    const toml = fs.readFileSync(path.join(__dirname, '../../../proxy/wrangler.toml'), 'utf8');
    const match = /^ALLOWED_REDIRECT_URIS\s*=\s*"([^"]*)"/m.exec(toml);
    expect(match?.[1]?.split(',').map((u) => u.trim())).toEqual([OAUTH_REDIRECT_URI]);
  });

  it("relays Tumblr's error status and body", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 401 })) as typeof fetch;
    const response = await handleRequest(
      tokenRequest({ grant_type: 'refresh_token', refresh_token: 'dead' }),
      env,
      { fetchImpl },
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'invalid_grant' });
  });

  it('answers 502 when Tumblr is unreachable or returns non-JSON', async () => {
    const down = (async () => {
      throw new Error('offline');
    }) as typeof fetch;
    const html = (async () => new Response('<html>', { status: 200 })) as typeof fetch;
    const body = { grant_type: 'refresh_token', refresh_token: 'r' };
    expect((await handleRequest(tokenRequest(body), env, { fetchImpl: down })).status).toBe(502);
    expect((await handleRequest(tokenRequest(body), env, { fetchImpl: html })).status).toBe(502);
  });

  it('handles CORS preflight, unknown paths and wrong methods', async () => {
    const options = await handleRequest(
      new Request('https://proxy.example/token', { method: 'OPTIONS' }),
      env,
    );
    expect(options.status).toBe(204);
    const missing = await handleRequest(new Request('https://proxy.example/other'), env);
    expect(missing.status).toBe(404);
    const get = await handleRequest(new Request('https://proxy.example/token'), env);
    expect(get.status).toBe(405);
  });

  it('limits requests per IP', async () => {
    const { fetchImpl } = upstreamOk();
    const body = { grant_type: 'refresh_token', refresh_token: 'r' };
    let last = 200;
    for (let i = 0; i <= RATE_LIMIT.limit; i += 1) {
      last = (await handleRequest(tokenRequest(body), env, { fetchImpl, now: () => 1000 })).status;
    }
    expect(last).toBe(429);
  });

  it('fails closed when the secret is missing', async () => {
    const response = await handleRequest(
      tokenRequest({ grant_type: 'refresh_token', refresh_token: 'r' }),
      { TUMBLR_CLIENT_ID: 'x' } as Env,
    );
    expect(response.status).toBe(500);
  });
});

describe('parseGrant', () => {
  it('accepts the two supported grants', () => {
    expect(parseGrant({ grant_type: 'refresh_token', refresh_token: 'r' })).toEqual({
      grant_type: 'refresh_token',
      refresh_token: 'r',
    });
  });
});
