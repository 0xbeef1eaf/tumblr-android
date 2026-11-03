import { QueryClientProvider, QueryObserver } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import {
  AuthConfigError,
  createMemoryTokenStore,
  OAUTH_REDIRECT_URI,
  OAuthError,
  type TokenSet,
} from '@/api/auth';
import { getTokenProvider, setTokenProvider } from '@/api/client';
import { UserInfoResponseSchema } from '@/api/schemas/user';
import { fixtures } from '@/test/msw';
import { createTestQueryClient } from '@/test/render';
import { useToastStore } from '@/ui/primitives/toastStore';

import { AuthProvider } from './AuthProvider';
import { useAuthStore } from './authStore';
import { useInteractionStore } from './interactionStore';
import { createSessionController, sessionController } from './sessionController';

const userInfo = UserInfoResponseSchema.parse(fixtures.userInfo.response).user;
const tokens: TokenSet = { accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 600_000 };
const messages = () => useToastStore.getState().toasts.map((t) => t.message);

function setup(initial: TokenSet | null = null, overrides = {}) {
  const store = createMemoryTokenStore(initial);
  const client = createTestQueryClient();
  const fetchUser = jest.fn(async () => userInfo);
  const controller = createSessionController({
    store,
    fetchUser,
    checkConfig: () => undefined,
    ...overrides,
  });
  controller.attachQueryClient(client);
  return { store, client, fetchUser, controller };
}

beforeEach(() => {
  useAuthStore.getState().setGuest();
  useInteractionStore.getState().reset();
  useToastStore.getState().clear();
});

describe('bootstrap', () => {
  it('becomes guest when no tokens are stored', async () => {
    const { controller, fetchUser } = setup(null);
    const pending = controller.bootstrap();
    expect(useAuthStore.getState().status).toBe('loading');
    await pending;
    expect(useAuthStore.getState().status).toBe('guest');
    expect(fetchUser).not.toHaveBeenCalled();
  });

  it('signs in with the verified user when tokens exist', async () => {
    const { controller, client } = setup(tokens);
    await controller.bootstrap();
    expect(useAuthStore.getState()).toMatchObject({
      status: 'signedIn',
      user: { name: 'pixelwanderer', primaryBlog: 'pixelwanderer' },
    });
    expect(client.getQueryData(['user'])).toEqual(userInfo);
  });

  it('shows the signed-in UI at once from the persisted user hint', async () => {
    useAuthStore.getState().setSignedIn({ name: 'hinted', primaryBlog: 'hinted' });
    useAuthStore.setState({ status: 'guest' });
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { controller } = setup(tokens, {
      fetchUser: async () => {
        await gate;
        return userInfo;
      },
    });
    const pending = controller.bootstrap();
    await new Promise((r) => setTimeout(r, 0));
    expect(useAuthStore.getState()).toMatchObject({ status: 'signedIn', user: { name: 'hinted' } });
    release();
    await pending;
    expect(useAuthStore.getState().user?.name).toBe('pixelwanderer');
  });

  it('stays signed in when verification fails offline', async () => {
    const { controller } = setup(tokens, {
      fetchUser: async () => {
        throw new TypeError('Network request failed');
      },
    });
    await controller.bootstrap();
    expect(useAuthStore.getState().status).toBe('signedIn');
  });
});

describe('signIn', () => {
  const authorize = async () => ({
    status: 'success' as const,
    code: 'the-code',
    redirectUri: OAUTH_REDIRECT_URI,
  });

  it('exchanges the code, persists tokens and loads the user', async () => {
    const exchangeCode = jest.fn(async () => tokens);
    const { controller, store, client } = setup(null, { authorize, exchangeCode });
    await controller.signIn();
    expect(exchangeCode).toHaveBeenCalledWith(
      'the-code',
      'https://0xbeef1eaf.github.io/tumblr-android/auth/callback',
    );
    await expect(store.load()).resolves.toEqual(tokens);
    expect(useAuthStore.getState()).toMatchObject({ status: 'signedIn' });
    expect(client.getQueryData(['user'])).toEqual(userInfo);
    await expect(controller.tokens.getAccessToken()).resolves.toBe('a');
    expect(messages()).toEqual(['Signed in to Tumblr']);
  });

  it('drops guest-fetched pages (no `liked`) when signing in', async () => {
    const { controller, client } = setup(null, { authorize, exchangeCode: async () => tokens });
    for (const root of ['tagged', 'blog', 'post', 'search']) {
      client.setQueryData([root, 'x'], { root });
    }
    await controller.signIn();
    const remaining = client
      .getQueryCache()
      .getAll()
      .map((q) => q.queryKey[0]);
    expect(remaining.sort()).toEqual(['search', 'user']);
  });

  it('refetches an on-screen tag gallery as the signed-in viewer', async () => {
    const { controller, client } = setup(null, { authorize, exchangeCode: async () => tokens });
    let fetches = 0;
    const queryFn = jest.fn(async () => ({ liked: ++fetches > 1 }));
    const observer = new QueryObserver(client, { queryKey: ['tagged', 'cats'], queryFn });
    const unsubscribe = observer.subscribe(() => undefined);
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));
    await controller.signIn();
    await waitFor(() => expect(client.getQueryData(['tagged', 'cats'])).toEqual({ liked: true }));
    unsubscribe();
  });

  it('does nothing when the user cancels', async () => {
    const exchangeCode = jest.fn();
    const { controller, store } = setup(null, {
      authorize: async () => ({ status: 'cancelled' as const }),
      exchangeCode,
    });
    await controller.signIn();
    expect(exchangeCode).not.toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe('guest');
    expect(messages()).toEqual([]);
    await expect(store.load()).resolves.toBeNull();
  });

  it('runs only one flow at a time', async () => {
    const authorizeSpy = jest.fn(authorize);
    const { controller } = setup(null, {
      authorize: authorizeSpy,
      exchangeCode: async () => tokens,
    });
    await Promise.all([controller.signIn(), controller.signIn()]);
    expect(authorizeSpy).toHaveBeenCalledTimes(1);
  });

  it('refuses a forged state: no exchange, no tokens, error toast', async () => {
    const exchangeCode = jest.fn();
    const { controller, store } = setup(null, {
      authorize: async () => {
        throw new OAuthError('state_mismatch', 'mismatch');
      },
      exchangeCode,
    });
    await controller.signIn();
    expect(exchangeCode).not.toHaveBeenCalled();
    await expect(store.load()).resolves.toBeNull();
    expect(useAuthStore.getState().status).toBe('guest');
    expect(messages()).toEqual(['Sign-in failed. Please try again.']);
  });

  it('explains missing configuration', async () => {
    const { controller } = setup(null, {
      authorize,
      exchangeCode: async () => {
        throw new AuthConfigError('Sign-in is not configured: set EXPO_PUBLIC_TOKEN_EXCHANGE_URL');
      },
    });
    await controller.signIn();
    expect(messages()[0]).toMatch(/not configured/);
  });

  it('rolls back tokens if the profile cannot be loaded', async () => {
    const { controller, store } = setup(null, {
      authorize,
      exchangeCode: async () => tokens,
      fetchUser: async () => {
        throw new Error('boom');
      },
    });
    await controller.signIn();
    await expect(store.load()).resolves.toBeNull();
    expect(useAuthStore.getState().status).toBe('guest');
  });
});

describe('signOut', () => {
  it('clears tokens, session, optimistic state and viewer-specific queries', async () => {
    const { controller, store, client } = setup(tokens);
    await controller.bootstrap();
    const roots = [
      'dashboard',
      'forYou',
      'likes',
      'user',
      'following',
      'tagged',
      'blog',
      'post',
      'search',
    ];
    for (const root of roots) {
      client.setQueryData([root, 'x'], { root });
    }
    useInteractionStore.getState().setLike('1', true);

    await controller.signOut();

    await expect(store.load()).resolves.toBeNull();
    expect(useAuthStore.getState()).toMatchObject({ status: 'guest', user: null });
    expect(useInteractionStore.getState().likes).toEqual({});
    const remaining = client
      .getQueryCache()
      .getAll()
      .map((q) => q.queryKey[0]);
    expect(remaining.sort()).toEqual(['search']);
    await expect(controller.tokens.getAccessToken()).resolves.toBeNull();
  });
});

describe('AuthProvider', () => {
  afterEach(() => setTokenProvider(null));

  it('installs the token provider and restores the session on mount', async () => {
    await sessionController.tokens.setTokens(tokens);
    useAuthStore.getState().setSignedIn({ name: 'pixelwanderer', primaryBlog: 'pixelwanderer' });
    useAuthStore.setState({ status: 'guest' });
    const client = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { unmount } = await render(<AuthProvider>{null}</AuthProvider>, { wrapper });
    expect(getTokenProvider()).toBe(sessionController.tokens);
    await new Promise((r) => setTimeout(r, 50));
    expect(useAuthStore.getState().status).toBe('signedIn');
    await unmount();
    expect(getTokenProvider()).not.toBe(sessionController.tokens);
    await sessionController.tokens.clearTokens();
  });
});
