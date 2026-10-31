import { OAuthError } from '@/api/auth';

import { authorize, generateState, type AuthPromptResult } from './oauth';

// The jest-expo native mock returns all-zero bytes; use real randomness to test uniqueness.
jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: async (count: number) =>
    new Uint8Array(jest.requireActual<typeof import('crypto')>('crypto').randomBytes(count)),
}));

const REDIRECT = 'tumblrgallery://auth/callback';

function fakeRequest(result: (state: string) => AuthPromptResult) {
  const configs: Record<string, unknown>[] = [];
  const discoveries: unknown[] = [];
  const createRequest = (config: { state?: string }) => {
    configs.push(config as Record<string, unknown>);
    return {
      promptAsync: async (discovery: unknown) => {
        discoveries.push(discovery);
        return result(config.state as string);
      },
    };
  };
  return { createRequest, configs, discoveries };
}

const deps = (fake: ReturnType<typeof fakeRequest>) => ({
  generateState: async () => 'state-123',
  redirectUri: REDIRECT,
  clientId: 'consumer-key',
  createRequest: fake.createRequest,
});

describe('authorize', () => {
  it('requests code flow without PKCE and returns the verified code', async () => {
    const fake = fakeRequest((state) => ({ type: 'success', params: { code: 'abc', state } }));
    await expect(authorize(deps(fake))).resolves.toEqual({
      status: 'success',
      code: 'abc',
      redirectUri: REDIRECT,
    });
    expect(fake.configs[0]).toEqual({
      clientId: 'consumer-key',
      scopes: ['basic', 'write', 'offline_access'],
      redirectUri: REDIRECT,
      usePKCE: false,
      state: 'state-123',
    });
    expect(fake.discoveries[0]).toEqual({
      authorizationEndpoint: 'https://www.tumblr.com/oauth2/authorize',
      tokenEndpoint: 'https://api.tumblr.com/v2/oauth2/token',
    });
  });

  it('rejects a response whose state does not match (CSRF)', async () => {
    const fake = fakeRequest(() => ({ type: 'success', params: { code: 'abc', state: 'forged' } }));
    await expect(authorize(deps(fake))).rejects.toMatchObject({
      name: 'OAuthError',
      code: 'state_mismatch',
    });
  });

  it('rejects a response with no state at all', async () => {
    const fake = fakeRequest(() => ({ type: 'success', params: { code: 'abc' } }));
    await expect(authorize(deps(fake))).rejects.toBeInstanceOf(OAuthError);
  });

  it('reports a state mismatch surfaced by the library as an error result', async () => {
    const fake = fakeRequest(() => ({
      type: 'error',
      params: { state: 'forged' },
      error: { message: 'Cross-Site request verification failed' },
    }));
    await expect(authorize(deps(fake))).rejects.toMatchObject({ code: 'state_mismatch' });
  });

  it('maps provider errors and access_denied', async () => {
    const denied = fakeRequest((state) => ({
      type: 'success',
      params: { error: 'access_denied', state },
    }));
    await expect(authorize(deps(denied))).rejects.toMatchObject({ code: 'access_denied' });
    const failed = fakeRequest(() => ({ type: 'error', error: { message: 'boom' } }));
    await expect(authorize(deps(failed))).rejects.toMatchObject({
      code: 'provider_error',
      message: 'boom',
    });
  });

  it.each(['cancel', 'dismiss', 'opened', 'locked'])('resolves cancelled on %s', async (type) => {
    const fake = fakeRequest(() => ({ type }));
    await expect(authorize(deps(fake))).resolves.toEqual({ status: 'cancelled' });
  });
});

describe('generateState', () => {
  it('returns 128 random bits as hex, different each time', async () => {
    const [a, b] = [await generateState(), await generateState()];
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toBe(b);
  });
});
