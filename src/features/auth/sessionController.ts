import type { QueryClient } from '@tanstack/react-query';

import {
  assertSignInConfigured,
  AuthConfigError,
  exchangeCode as exchangeCodeRequest,
  OAuthError,
  secureTokenStore,
  type TokenSet,
  type TokenStore,
} from '@/api/auth';
import { getUserInfo } from '@/api/endpoints/user';
import { isApiError } from '@/api/errors';
import type { UserInfo } from '@/api/schemas/user';
import { openSettings } from '@/features/credentials/navigation';
import { createLogger } from '@/lib/log';
import { queryClient as defaultQueryClient } from '@/lib/queryClient';
import { toast } from '@/ui/primitives/toastStore';

import { useAuthStore } from './authStore';
import { useInteractionStore } from './interactionStore';
import { authorize, type AuthorizeResult } from './oauth';
import { toSessionUser } from './sessionUser';
import { createTokenManager, type TokenManager } from './tokenProvider';

const logger = createLogger('session');

/** Query roots that belong to the signed-in user and are dropped on sign-out. */
export const USER_SCOPED_QUERY_ROOTS = ['dashboard', 'likes', 'user', 'following'] as const;

/**
 * Public reads that are fetched with the session's token when there is one (`auth: 'auto'`),
 * so their pages carry the viewer's `liked`/`followed`. Dropped on sign-in and sign-out.
 */
export const VIEWER_DEPENDENT_QUERY_ROOTS = ['post', 'blog', 'tagged'] as const;

const hasRoot = (roots: readonly string[]) => (query: { queryKey: readonly unknown[] }) =>
  typeof query.queryKey[0] === 'string' && roots.includes(query.queryKey[0]);

/**
 * Drop everything fetched as the previous viewer: user-scoped roots entirely; viewer-dependent
 * roots too, except that queries on screen are reset (refetched as the new viewer) instead of
 * being removed from under their observers.
 */
export function removeUserQueries(client: QueryClient): void {
  client.removeQueries({ predicate: hasRoot(USER_SCOPED_QUERY_ROOTS) });
  const viewerDependent = hasRoot(VIEWER_DEPENDENT_QUERY_ROOTS);
  client.removeQueries({ predicate: viewerDependent, type: 'inactive' });
  void client.resetQueries({ predicate: viewerDependent, type: 'active' });
}

export interface SessionControllerDeps {
  store?: TokenStore;
  authorize?: () => Promise<AuthorizeResult>;
  exchangeCode?: (code: string, redirectUri: string) => Promise<TokenSet>;
  refresh?: (refreshToken: string) => Promise<TokenSet>;
  fetchUser?: () => Promise<UserInfo>;
  now?: () => number;
  /** Throws `AuthConfigError` when sign-in cannot complete; checked before the sign-in WebView opens. */
  checkConfig?: () => void;
}

export interface SessionController {
  tokens: TokenManager;
  attachQueryClient(client: QueryClient): void;
  /** Restore the stored session; waits for `ready` (the credentials load) first. */
  bootstrap(ready?: Promise<unknown>): Promise<void>;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
}

function signInErrorMessage(error: unknown): string {
  if (error instanceof AuthConfigError) return error.message;
  if (error instanceof OAuthError) {
    return error.code === 'access_denied'
      ? 'Sign-in was cancelled'
      : 'Sign-in failed. Please try again.';
  }
  if (isApiError(error)) return 'Tumblr rejected the sign-in. Please try again.';
  return 'Sign-in failed. Check your connection and try again.';
}

export function createSessionController(deps: SessionControllerDeps = {}): SessionController {
  const fetchUser = deps.fetchUser ?? (() => getUserInfo());
  const runAuthorize = deps.authorize ?? (() => authorize());
  const exchange = deps.exchangeCode ?? ((code, uri) => exchangeCodeRequest(code, uri));
  const checkConfig = deps.checkConfig ?? (() => assertSignInConfigured());
  let client: QueryClient = defaultQueryClient;
  let signInInFlight: Promise<void> | null = null;

  const signOut = async (): Promise<void> => {
    await tokens.clearTokens();
    useAuthStore.getState().setGuest();
    useInteractionStore.getState().reset();
    removeUserQueries(client);
  };

  const tokens = createTokenManager({
    store: deps.store ?? secureTokenStore,
    refresh: deps.refresh,
    now: deps.now,
    signOut,
  });

  const applyUser = (info: UserInfo, firstTime: boolean): void => {
    const user = toSessionUser(info);
    const auth = useAuthStore.getState();
    if (firstTime) auth.setSignedIn(user);
    else auth.setUser(user);
    client.setQueryData(['user'], info);
  };

  const bootstrap = async (ready?: Promise<unknown>): Promise<void> => {
    const auth = useAuthStore.getState();
    auth.setLoading();
    // Token refresh needs the consumer key/secret, so credentials load first.
    await ready?.catch(() => undefined);
    const stored = await tokens.loadTokens();
    if (!stored) {
      useAuthStore.getState().setGuest();
      return;
    }
    const hint = useAuthStore.getState().user;
    // Known user from the last session: show the signed-in UI at once, verify in background.
    if (hint) useAuthStore.getState().setSignedIn(hint);
    try {
      const info = await fetchUser();
      if (tokens.hasTokens()) applyUser(info, !hint);
    } catch (error) {
      if (!tokens.hasTokens()) return; // the 401 path already signed out
      logger.warn('Could not verify the stored session', error);
      if (!hint) useAuthStore.getState().setSignedIn({ name: '' });
    }
  };

  const doSignIn = async (): Promise<void> => {
    try {
      checkConfig();
    } catch (error) {
      // Missing key/secret: nothing to undo, just point the user at Settings.
      toast.error(signInErrorMessage(error), {
        durationMs: 6000,
        action: { label: 'Settings', onPress: openSettings },
      });
      return;
    }
    try {
      const result = await runAuthorize();
      if (result.status === 'cancelled') return;
      await tokens.setTokens(await exchange(result.code, result.redirectUri));
      const info = await fetchUser();
      // Guest-fetched pages lack `liked`/`followed`; refetch them with the new token.
      removeUserQueries(client);
      applyUser(info, true);
      toast.success('Signed in to Tumblr');
    } catch (error) {
      logger.warn('Sign-in failed', error);
      await tokens.clearTokens();
      useAuthStore.getState().setGuest();
      toast.error(signInErrorMessage(error));
    }
  };

  const signIn = (): Promise<void> => {
    signInInFlight ??= doSignIn().finally(() => {
      signInInFlight = null;
    });
    return signInInFlight;
  };

  return {
    tokens,
    attachQueryClient: (next) => {
      client = next;
    },
    bootstrap,
    signIn,
    signOut,
  };
}

/** The app-wide session. Tests build their own with `createSessionController`. */
export const sessionController = createSessionController();
