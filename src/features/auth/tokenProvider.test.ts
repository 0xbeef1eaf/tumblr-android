import { http, HttpResponse } from 'msw';
import { z } from 'zod';

import oauthToken from '@/api/fixtures/oauth.token.json';
import { createMemoryTokenStore, refreshToken as realRefresh, type TokenSet } from '@/api/auth';
import { apiFetch, getTokenProvider, setTokenProvider } from '@/api/client';
import { ApiError } from '@/api/errors';
import { getUserInfo } from '@/api/endpoints/user';
import type { Env } from '@/lib/env';
import { API, server } from '@/test/msw';
import { useToastStore } from '@/ui/primitives/toastStore';

import { createTokenManager, SIGNED_OUT_MESSAGE } from './tokenProvider';

const NOW = 1_000_000_000;
const fresh: TokenSet = { accessToken: 'fresh', refreshToken: 'r1', expiresAt: NOW + 600_000 };
const expiring: TokenSet = { accessToken: 'old', refreshToken: 'r1', expiresAt: NOW + 30_000 };
const rotated: TokenSet = { accessToken: 'new', refreshToken: 'r2', expiresAt: NOW + 2_520_000 };

function setup(initial: TokenSet | null, refresh: (rt: string) => Promise<TokenSet>) {
  const store = createMemoryTokenStore(initial);
  const signOut = jest.fn(async () => {
    await manager.clearTokens();
  });
  const manager = createTokenManager({ store, refresh, now: () => NOW, signOut });
  return { store, signOut, manager };
}

beforeEach(() => useToastStore.getState().clear());
afterEach(() => setTokenProvider(null));

describe('getAccessToken', () => {
  it('returns null for guests and never refreshes', async () => {
    const refresh = jest.fn();
    const { manager } = setup(null, refresh);
    await expect(manager.getAccessToken()).resolves.toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('returns a fresh token without refreshing', async () => {
    const refresh = jest.fn();
    const { manager } = setup(fresh, refresh);
    await expect(manager.getAccessToken()).resolves.toBe('fresh');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('refreshes proactively when < 60 s remain and persists the new tokens', async () => {
    const refresh = jest.fn(async () => rotated);
    const { manager, store } = setup(expiring, refresh);
    await expect(manager.getAccessToken()).resolves.toBe('new');
    expect(refresh).toHaveBeenCalledWith('r1');
    await expect(store.load()).resolves.toEqual(rotated);
    // Now fresh: no second refresh.
    await expect(manager.getAccessToken()).resolves.toBe('new');
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('shares ONE in-flight refresh between concurrent callers (race)', async () => {
    let release: (tokens: TokenSet) => void = () => undefined;
    const refresh = jest.fn(
      () =>
        new Promise<TokenSet>((resolve) => {
          release = resolve;
        }),
    );
    const { manager } = setup(expiring, refresh);
    const calls = [manager.getAccessToken(), manager.getAccessToken(), manager.refresh()];
    await new Promise((r) => setTimeout(r, 0));
    release(rotated);
    await expect(Promise.all(calls)).resolves.toEqual(['new', 'new', 'new']);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('allows a new refresh after the previous one settled', async () => {
    const refresh = jest.fn(async () => rotated);
    const { manager } = setup(expiring, refresh);
    await manager.refresh();
    await manager.refresh();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('keeps using a still-valid token when the refresh fails transiently', async () => {
    const refresh = jest.fn(async () => {
      throw new TypeError('Network request failed');
    });
    const { manager, signOut } = setup(expiring, refresh);
    await expect(manager.getAccessToken()).resolves.toBe('old');
    expect(signOut).not.toHaveBeenCalled();
  });
});

describe('dead sessions', () => {
  it('signs out with a toast when the refresh token is rejected', async () => {
    const refresh = jest.fn(async () => {
      throw new ApiError({ status: 401, message: 'Refresh token is no longer valid' });
    });
    const { manager, signOut, store } = setup(expiring, refresh);
    await expect(manager.getAccessToken()).resolves.toBeNull();
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(useToastStore.getState().toasts.map((t) => t.message)).toEqual([SIGNED_OUT_MESSAGE]);
    await expect(store.load()).resolves.toBeNull();
    // The follow-up onAuthFailure from apiFetch must not sign out / toast again.
    manager.onAuthFailure();
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it('onAuthFailure signs out and shows the toast once', async () => {
    const { manager, signOut } = setup(fresh, jest.fn());
    await manager.loadTokens();
    manager.onAuthFailure();
    manager.onAuthFailure();
    await new Promise((r) => setTimeout(r, 0));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      message: 'Signed out — please sign in again',
      kind: 'error',
    });
  });

  it('treats a missing refresh token as dead', async () => {
    const { manager } = setup({ accessToken: 'a', expiresAt: NOW + 1000 }, jest.fn());
    await expect(manager.refresh()).resolves.toBeNull();
  });
});

describe('apiFetch integration (msw)', () => {
  const env: Env = {
    tumblrApiKey: 'consumer-key',
    tokenExchangeUrl: 'https://proxy.example/token',
    appVersion: '1.0.0',
    isTest: true,
  };
  const staleToken: TokenSet = {
    accessToken: 'stale',
    refreshToken: 'r-live',
    expiresAt: NOW + 600_000,
  };

  function mockUserInfo(validToken: string) {
    const seen: (string | null)[] = [];
    server.use(
      http.get(`${API}/v2/user/info`, ({ request }) => {
        const header = request.headers.get('Authorization');
        seen.push(header);
        if (header !== `Bearer ${validToken}`) {
          return HttpResponse.json(
            { meta: { status: 401, msg: 'Unauthorized' }, response: [] },
            { status: 401 },
          );
        }
        return HttpResponse.json({
          meta: { status: 200, msg: 'OK' },
          response: { user: { name: 'pixelwanderer', blogs: [] } },
        });
      }),
    );
    return seen;
  }

  it('401 → refresh → retry succeeds with the new token', async () => {
    const refreshBodies: Record<string, unknown>[] = [];
    server.use(
      http.post('https://proxy.example/token', async ({ request }) => {
        refreshBodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ ...oauthToken, access_token: 'renewed' });
      }),
    );
    const seen = mockUserInfo('renewed');
    const { manager, signOut } = setup(staleToken, (rt) => realRefresh(rt, { env }));
    setTokenProvider(manager);

    const user = await getUserInfo();
    expect(user.name).toBe('pixelwanderer');
    expect(seen).toEqual(['Bearer stale', 'Bearer renewed']);
    expect(refreshBodies).toHaveLength(1);
    expect(refreshBodies[0]).toMatchObject({
      grant_type: 'refresh_token',
      refresh_token: 'r-live',
    });
    expect(signOut).not.toHaveBeenCalled();
  });

  it('concurrent 401s trigger a single refresh', async () => {
    let refreshCalls = 0;
    server.use(
      http.post('https://proxy.example/token', () => {
        refreshCalls += 1;
        return HttpResponse.json({ ...oauthToken, access_token: 'renewed' });
      }),
    );
    mockUserInfo('renewed');
    const { manager } = setup(staleToken, (rt) => realRefresh(rt, { env }));
    setTokenProvider(manager);
    await Promise.all([getUserInfo(), getUserInfo(), getUserInfo()]);
    expect(refreshCalls).toBe(1);
  });

  it('401 → refresh rejected → signs out and surfaces the 401', async () => {
    server.use(
      http.post('https://proxy.example/token', () =>
        HttpResponse.json({ error: 'invalid_grant' }, { status: 401 }),
      ),
    );
    mockUserInfo('never');
    const { manager, signOut } = setup(staleToken, (rt) => realRefresh(rt, { env }));
    setTokenProvider(manager);

    await expect(getUserInfo()).rejects.toMatchObject({ status: 401 });
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(useToastStore.getState().toasts.map((t) => t.message)).toEqual([SIGNED_OUT_MESSAGE]);
    expect(getTokenProvider()).toBe(manager);
  });

  it('a guest provider makes bearer calls fail without hitting the network', async () => {
    const { manager } = setup(null, jest.fn());
    setTokenProvider(manager);
    await expect(
      apiFetch('/v2/user/info', { auth: 'bearer', schema: z.unknown() }),
    ).rejects.toMatchObject({ status: 401, code: 'not_authenticated' });
  });
});
