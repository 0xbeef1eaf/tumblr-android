import { create } from 'zustand';

import { parseAuthorizationResponse } from '@/api/auth';

/** One pending authorization: what the sign-in WebView loads and how it recognises the end. */
export interface OAuthFlowRequest {
  /** Tumblr's authorize URL, with `state` and `redirect_uri`. */
  url: string;
  state: string;
  redirectUri: string;
}

export type OAuthFlowResult =
  { status: 'success'; code: string; redirectUri: string } | { status: 'cancelled' };

interface OAuthFlowState {
  request: OAuthFlowRequest | null;
  resolve: ((result: OAuthFlowResult) => void) | null;
  reject: ((error: Error) => void) | null;
}

interface OAuthFlowActions {
  /** Start a flow; a still-pending older one resolves `cancelled`. */
  begin(request: OAuthFlowRequest): Promise<OAuthFlowResult>;
  /**
   * Settle the pending flow from the intercepted callback URL: resolves with the code or
   * rejects with an `OAuthError` (`state_mismatch`, `access_denied`, `provider_error`, …).
   */
  complete(callbackUrl: string): void;
  /** Resolve `cancelled`. With `request`, only if that flow is still the pending one. */
  cancel(request?: OAuthFlowRequest): void;
  /** Reject the pending flow (e.g. navigation to the sign-in screen failed). */
  fail(error: Error): void;
}

const idle: OAuthFlowState = { request: null, resolve: null, reject: null };

/**
 * Bridge between `authorize()` (a promise) and the `/auth/sign-in` screen (a WebView). Every
 * action settles at most once: the state is cleared before the promise is settled, so a later
 * dismissal (Cancel, back, unmount) after success is a no-op.
 */
export const useOAuthFlowStore = create<OAuthFlowState & OAuthFlowActions>()((set, get) => {
  const take = (): OAuthFlowState => {
    const current = { request: get().request, resolve: get().resolve, reject: get().reject };
    set(idle);
    return current;
  };

  return {
    ...idle,
    begin: (request) => {
      get().cancel();
      return new Promise<OAuthFlowResult>((resolve, reject) => {
        set({ request, resolve, reject });
      });
    },
    complete: (callbackUrl) => {
      const { request, resolve, reject } = take();
      if (!request) return;
      try {
        const code = parseAuthorizationResponse(parseCallbackParams(callbackUrl), request.state);
        resolve?.({ status: 'success', code, redirectUri: request.redirectUri });
      } catch (error) {
        reject?.(error instanceof Error ? error : new Error(String(error)));
      }
    },
    cancel: (request) => {
      const pending = get().request;
      if (!pending || (request !== undefined && pending !== request)) return;
      take().resolve?.({ status: 'cancelled' });
    },
    fail: (error) => {
      if (get().request) take().reject?.(error);
    },
  };
});

/**
 * True when `url` is the callback URL itself (optionally with a query or fragment), not merely
 * a longer path that happens to start with it.
 */
export function isRedirectUrl(url: string, redirectUri: string): boolean {
  if (!url.startsWith(redirectUri)) return false;
  const next = url.charAt(redirectUri.length);
  return next === '' || next === '?' || next === '#';
}

function decodeComponent(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}

/**
 * Query parameters of a callback URL (`code`, `state`, `error`, `error_description`); the
 * first occurrence of a key wins. Parsed by hand: no reliance on a `URL` polyfill.
 */
export function parseCallbackParams(url: string): Record<string, string> {
  const query = url.split('#', 1)[0]?.split('?').slice(1).join('?') ?? '';
  const params: Record<string, string> = {};
  for (const pair of query.split('&')) {
    const [rawKey = '', ...rest] = pair.split('=');
    const key = decodeComponent(rawKey);
    if (key && !Object.prototype.hasOwnProperty.call(params, key))
      params[key] = decodeComponent(rest.join('='));
  }
  return params;
}
