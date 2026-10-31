import {
  isExpiring,
  refreshToken as refreshTokenRequest,
  type TokenSet,
  type TokenStore,
} from '@/api/auth';
import type { TokenProvider } from '@/api/client';
import { isApiError } from '@/api/errors';
import { createLogger } from '@/lib/log';
import { toast } from '@/ui/primitives/toastStore';

const logger = createLogger('tokens');

export const SIGNED_OUT_MESSAGE = 'Signed out — please sign in again';

export interface TokenManagerDeps {
  store: TokenStore;
  /** Exchanges a refresh token for a new token set (defaults to the real endpoint). */
  refresh?: (refreshToken: string) => Promise<TokenSet>;
  now?: () => number;
  /** Full sign-out (clear tokens, session state, user queries). Called on a dead session. */
  signOut: () => Promise<void> | void;
}

export interface TokenManager extends TokenProvider {
  /** Load from the secure store (once) and return the cached tokens. */
  loadTokens(): Promise<TokenSet | null>;
  /** Persist and cache a new token set (after sign-in). */
  setTokens(tokens: TokenSet): Promise<void>;
  /** Forget tokens everywhere (store + memory). Does not toast. */
  clearTokens(): Promise<void>;
  /** Synchronous peek: `true` unless tokens are known to be absent. */
  hasTokens(): boolean;
}

/** Refresh-token rejections that mean "the session is dead" rather than "try again later". */
function isDeadSession(error: unknown): boolean {
  return isApiError(error) && [400, 401, 403].includes(error.status);
}

/**
 * `TokenProvider` for `setTokenProvider()`. Hands out a fresh access token, refreshing
 * proactively when < 60 s remain. Concurrent callers share one in-flight refresh promise,
 * so a burst of requests (or a 401 racing a proactive refresh) triggers a single network call.
 */
export function createTokenManager(deps: TokenManagerDeps): TokenManager {
  const { store, signOut } = deps;
  const refreshRequest = deps.refresh ?? ((rt: string) => refreshTokenRequest(rt));
  const now = deps.now ?? Date.now;

  let cached: TokenSet | null = null;
  let loaded = false;
  let loading: Promise<TokenSet | null> | null = null;
  let inFlightRefresh: Promise<string | null> | null = null;

  const loadTokens = (): Promise<TokenSet | null> => {
    if (loaded) return Promise.resolve(cached);
    loading ??= store
      .load()
      .catch((error: unknown) => {
        logger.warn('Could not read stored tokens', error);
        return null;
      })
      .then((tokens) => {
        // A sign-in that finished while we were loading wins over the stored value.
        if (!loaded) {
          cached = tokens;
          loaded = true;
        }
        loading = null;
        return cached;
      });
    return loading;
  };

  const setTokens = async (tokens: TokenSet): Promise<void> => {
    await store.save(tokens);
    cached = tokens;
    loaded = true;
  };

  const clearTokens = async (): Promise<void> => {
    cached = null;
    loaded = true;
    await store.clear();
  };

  const endSession = async (): Promise<void> => {
    toast.error(SIGNED_OUT_MESSAGE);
    await signOut();
  };

  const doRefresh = async (): Promise<string | null> => {
    const tokens = await loadTokens();
    if (!tokens?.refreshToken) return null;
    try {
      const next = await refreshRequest(tokens.refreshToken);
      await setTokens(next);
      return next.accessToken;
    } catch (error) {
      if (isDeadSession(error)) {
        logger.warn('Refresh token rejected; ending session');
        await endSession();
        return null;
      }
      throw error;
    }
  };

  const refresh = (): Promise<string | null> => {
    inFlightRefresh ??= doRefresh().finally(() => {
      inFlightRefresh = null;
    });
    return inFlightRefresh;
  };

  const getAccessToken = async (): Promise<string | null> => {
    const tokens = await loadTokens();
    if (!tokens) return null;
    if (!isExpiring(tokens, now())) return tokens.accessToken;
    if (!tokens.refreshToken) return tokens.expiresAt > now() ? tokens.accessToken : null;
    try {
      return await refresh();
    } catch (error) {
      // Transient failure (offline…): the old token may still be good for a moment.
      if (tokens.expiresAt > now()) return tokens.accessToken;
      throw error;
    }
  };

  const onAuthFailure = (): void => {
    // Idempotent: a dead refresh already signed out, and guests never reach here.
    if (loaded && !cached) return;
    void Promise.resolve(endSession()).catch((error: unknown) =>
      logger.warn('Sign-out after auth failure failed', error),
    );
  };

  return {
    getAccessToken,
    refresh,
    onAuthFailure,
    loadTokens,
    setTokens,
    clearTokens,
    hasTokens: () => !loaded || cached !== null,
  };
}
