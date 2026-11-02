import { env as defaultEnv, type Env } from '@/lib/env';

/** The authorization request: where the sign-in WebView goes and where it must come back. */
export const AUTHORIZE_URL = 'https://www.tumblr.com/oauth2/authorize';
export const OAUTH_SCOPES = ['basic', 'write', 'offline_access'] as const;
/**
 * OAuth2 callback (redirect) URL. It is only an identifier: the sign-in WebView
 * (`features/auth/SignInWebView.tsx`) intercepts the navigation to it before it loads, so
 * nothing is served there and no server is involved. Tumblr's app form only accepts
 * http(s) URLs, hence https rather than the app's custom scheme. It must be entered verbatim
 * as the Tumblr app's "Default callback URL"; forks can override it with
 * `EXPO_PUBLIC_OAUTH_REDIRECT_URI` (see `getOAuthRedirectUri`).
 */
export const OAUTH_REDIRECT_URI = 'https://0xbeef1eaf.github.io/tumblr-android/auth/callback';

/** The callback URL in effect: the build's override, else `OAUTH_REDIRECT_URI`. */
export function getOAuthRedirectUri(e: Env = defaultEnv): string {
  return e.oauthRedirectUri ?? OAUTH_REDIRECT_URI;
}

export interface AuthorizeUrlParams {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes?: readonly string[];
}

/**
 * Authorization-code request URL opened in the sign-in WebView. Tumblr does not document
 * PKCE, so none is sent; the random `state` is verified on return instead.
 */
export function buildAuthorizeUrl({
  clientId,
  redirectUri,
  state,
  scopes = OAUTH_SCOPES,
}: AuthorizeUrlParams): string {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    scope: scopes.join(' '),
    state,
    redirect_uri: redirectUri,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}
