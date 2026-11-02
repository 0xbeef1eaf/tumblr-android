import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';

import {
  AuthConfigError,
  buildAuthorizeUrl,
  getOAuthRedirectUri,
  MISSING_KEY_MESSAGE,
  OAUTH_SCOPES,
} from '@/api/auth';
import { getEffectiveCredentials } from '@/api/credentials';

import { useOAuthFlowStore, type OAuthFlowResult } from './oauthFlowStore';

/** The modal route that hosts the sign-in WebView (`app/auth/sign-in.tsx`). */
export const SIGN_IN_ROUTE = '/auth/sign-in';

/** 128 bits of CSPRNG output as hex: the OAuth `state` (CSRF token). */
export async function generateState(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export interface AuthorizeDeps {
  generateState?: () => Promise<string>;
  /** Defaults to `getOAuthRedirectUri()` (the https callback identifier). */
  redirectUri?: string;
  /** Defaults to the effective consumer key (Settings, else the build env). */
  clientId?: string;
  /** Presents the sign-in screen; defaults to `router.push(SIGN_IN_ROUTE)`. */
  openSignIn?: () => void;
}

export type AuthorizeResult = OAuthFlowResult;

/**
 * Run the Tumblr authorization-code flow in the in-app WebView: publish the request to
 * `useOAuthFlowStore`, present `/auth/sign-in`, and wait for that screen to intercept the
 * callback URL. Resolves `{ status: 'cancelled' }` if the user backs out; rejects with
 * `OAuthError` on a state mismatch or a provider error.
 */
export async function authorize(deps: AuthorizeDeps = {}): Promise<AuthorizeResult> {
  const clientId = deps.clientId ?? getEffectiveCredentials().consumerKey;
  if (!clientId) throw new AuthConfigError(MISSING_KEY_MESSAGE);
  const state = await (deps.generateState ?? generateState)();
  const redirectUri = deps.redirectUri ?? getOAuthRedirectUri();
  const url = buildAuthorizeUrl({ clientId, redirectUri, state, scopes: OAUTH_SCOPES });
  const flow = useOAuthFlowStore.getState();
  const result = flow.begin({ url, state, redirectUri });
  try {
    (deps.openSignIn ?? (() => router.push(SIGN_IN_ROUTE)))();
  } catch (error) {
    flow.fail(error instanceof Error ? error : new Error('Could not open the sign-in screen'));
  }
  return result;
}
