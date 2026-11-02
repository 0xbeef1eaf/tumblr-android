import { router } from 'expo-router';

import { AuthConfigError, OAUTH_REDIRECT_URI } from '@/api/auth';
import { credentialsStore } from '@/api/credentials';

import { authorize, generateState, SIGN_IN_ROUTE, type AuthorizeDeps } from './oauth';
import { useOAuthFlowStore } from './oauthFlowStore';

// The jest-expo native mock returns all-zero bytes; use real randomness to test uniqueness.
jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: async (count: number) =>
    new Uint8Array(jest.requireActual<typeof import('crypto')>('crypto').randomBytes(count)),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const CALLBACK = 'https://0xbeef1eaf.github.io/tumblr-android/auth/callback';

const openSignIn = jest.fn();
const deps: AuthorizeDeps = {
  generateState: async () => 'state-123',
  clientId: 'consumer-key',
  openSignIn,
};

/** Start `authorize()` and wait until it has published its request to the store. */
async function start(overrides: AuthorizeDeps = {}) {
  const result = authorize({ ...deps, ...overrides });
  // Swallow here; each test asserts on `result` itself.
  result.catch(() => undefined);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { result };
}

const flow = () => useOAuthFlowStore.getState();

afterEach(() => flow().cancel());

describe('authorize', () => {
  it('publishes the authorize request, opens the sign-in screen and resolves the code', async () => {
    const { result } = await start();
    const request = flow().request;
    expect(request).toMatchObject({ state: 'state-123', redirectUri: CALLBACK });
    const url = new URL(request?.url ?? '');
    expect(url.origin + url.pathname).toBe('https://www.tumblr.com/oauth2/authorize');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'consumer-key',
      response_type: 'code',
      scope: 'basic write offline_access',
      state: 'state-123',
      redirect_uri: CALLBACK,
    });
    expect(openSignIn).toHaveBeenCalledTimes(1);

    flow().complete(`${CALLBACK}?code=abc&state=state-123`);
    await expect(result).resolves.toEqual({
      status: 'success',
      code: 'abc',
      redirectUri: CALLBACK,
    });
    expect(flow().request).toBeNull();
  });

  it('pushes the sign-in route by default', async () => {
    await start({ openSignIn: undefined });
    expect(router.push).toHaveBeenCalledWith(SIGN_IN_ROUTE);
    expect(SIGN_IN_ROUTE).toBe('/auth/sign-in');
  });

  it("defaults clientId to the user's consumer key", async () => {
    await credentialsStore.save({ consumerKey: 'my-own-key', consumerSecret: 's' });
    await start({ clientId: undefined });
    expect(flow().request?.url).toContain('client_id=my-own-key');
  });

  it('refuses to open the sign-in screen without a consumer key', async () => {
    await credentialsStore.clear();
    await expect(authorize({ ...deps, clientId: undefined })).rejects.toBeInstanceOf(
      AuthConfigError,
    );
    expect(openSignIn).not.toHaveBeenCalled();
    expect(flow().request).toBeNull();
  });

  it('rejects a callback whose state does not match (CSRF)', async () => {
    const { result } = await start();
    flow().complete(`${CALLBACK}?code=abc&state=forged`);
    await expect(result).rejects.toMatchObject({ name: 'OAuthError', code: 'state_mismatch' });
  });

  it('maps access_denied and provider errors', async () => {
    const { result: denied } = await start();
    flow().complete(`${CALLBACK}?error=access_denied&state=state-123`);
    await expect(denied).rejects.toMatchObject({ code: 'access_denied' });

    const { result: failed } = await start();
    flow().complete(`${CALLBACK}?error=server_error&error_description=Try+later&state=state-123`);
    await expect(failed).rejects.toMatchObject({ code: 'provider_error', message: 'Try later' });
  });

  it('resolves cancelled when the screen is dismissed', async () => {
    const { result } = await start();
    flow().cancel(flow().request ?? undefined);
    await expect(result).resolves.toEqual({ status: 'cancelled' });
  });

  it('cancels a still-pending earlier flow when a new one starts', async () => {
    const { result: first } = await start({ generateState: async () => 'first' });
    const { result: second } = await start({ generateState: async () => 'second' });
    await expect(first).resolves.toEqual({ status: 'cancelled' });
    expect(flow().request?.state).toBe('second');
    flow().complete(`${CALLBACK}?code=c2&state=second`);
    await expect(second).resolves.toMatchObject({ status: 'success', code: 'c2' });
  });

  it('fails the flow when the sign-in screen cannot open', async () => {
    const result = authorize({
      ...deps,
      openSignIn: () => {
        throw new Error('no navigator');
      },
    });
    await expect(result).rejects.toThrow('no navigator');
    expect(flow().request).toBeNull();
  });

  it('uses OAUTH_REDIRECT_URI unless the build overrides it', async () => {
    expect(OAUTH_REDIRECT_URI).toBe(CALLBACK);
    const fork = 'https://fork.example.org/tumblr/callback';
    process.env.EXPO_PUBLIC_OAUTH_REDIRECT_URI = fork;
    try {
      await jest.isolateModulesAsync(async () => {
        // A fresh registry re-reads process.env into `env` (src/lib/env.ts).
        /* eslint-disable @typescript-eslint/no-require-imports */
        const isolated = require('./oauth') as typeof import('./oauth');
        const { useOAuthFlowStore: store } =
          require('./oauthFlowStore') as typeof import('./oauthFlowStore');
        /* eslint-enable @typescript-eslint/no-require-imports */
        const result = isolated.authorize(deps);
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(store.getState().request?.redirectUri).toBe(fork);
        expect(store.getState().request?.url).toContain(encodeURIComponent(fork));
        store.getState().complete(`${fork}?code=f&state=state-123`);
        await expect(result).resolves.toEqual({ status: 'success', code: 'f', redirectUri: fork });
      });
    } finally {
      delete process.env.EXPO_PUBLIC_OAUTH_REDIRECT_URI;
    }
  });
});

describe('generateState', () => {
  it('returns 128 random bits as hex, different each time', async () => {
    const [a, b] = [await generateState(), await generateState()];
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toBe(b);
  });
});
