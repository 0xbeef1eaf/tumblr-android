import {
  AuthRequest,
  makeRedirectUri,
  type AuthDiscoveryDocument,
  type AuthRequestConfig,
} from 'expo-auth-session';
import * as Crypto from 'expo-crypto';

import { AUTH_DISCOVERY, OAUTH_SCOPES, OAuthError, parseAuthorizationResponse } from '@/api/auth';
import { env } from '@/lib/env';

export const REDIRECT_SCHEME = 'tumblrgallery';
export const REDIRECT_PATH = 'auth/callback';

/** `tumblrgallery://auth/callback` in a standalone build (an `exp://` URL in Expo Go). */
export function createRedirectUri(): string {
  return makeRedirectUri({ scheme: REDIRECT_SCHEME, path: REDIRECT_PATH });
}

/** 128 bits of CSPRNG output as hex: the OAuth `state` (CSRF token). */
export async function generateState(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** The slice of `AuthRequest` the flow needs; injectable so tests need no browser. */
export interface AuthPrompt {
  promptAsync(discovery: AuthDiscoveryDocument): Promise<AuthPromptResult>;
}

/** Structural subset of expo-auth-session's `AuthSessionResult`. */
export interface AuthPromptResult {
  type: string;
  params?: Record<string, string>;
  error?: { message?: string } | null;
}

export interface AuthorizeDeps {
  generateState?: () => Promise<string>;
  redirectUri?: string;
  clientId?: string;
  createRequest?: (config: AuthRequestConfig) => AuthPrompt;
}

export type AuthorizeResult =
  { status: 'success'; code: string; redirectUri: string } | { status: 'cancelled' };

/**
 * Run the Tumblr authorization-code flow in the system browser. Tumblr does not document
 * PKCE, so `usePKCE` is off; the random `state` is verified on return instead.
 * Resolves `{ status: 'cancelled' }` if the user backs out; throws `OAuthError` otherwise.
 */
export async function authorize(deps: AuthorizeDeps = {}): Promise<AuthorizeResult> {
  const state = await (deps.generateState ?? generateState)();
  const redirectUri = deps.redirectUri ?? createRedirectUri();
  const config: AuthRequestConfig = {
    clientId: deps.clientId ?? env.tumblrApiKey,
    scopes: [...OAUTH_SCOPES],
    redirectUri,
    usePKCE: false,
    state,
  };
  const request = deps.createRequest ? deps.createRequest(config) : new AuthRequest(config);
  const result = await request.promptAsync(AUTH_DISCOVERY);

  switch (result.type) {
    case 'success':
      return {
        status: 'success',
        code: parseAuthorizationResponse(result.params ?? {}, state),
        redirectUri,
      };
    case 'error': {
      const params = result.params ?? {};
      // A state mismatch must never be reported as a plain provider error.
      if (params.state !== undefined && params.state !== state) {
        throw new OAuthError('state_mismatch', 'Sign-in response did not match the request');
      }
      throw new OAuthError(
        'provider_error',
        result.error?.message ?? params.error_description ?? params.error ?? 'Sign-in failed',
      );
    }
    default:
      return { status: 'cancelled' };
  }
}
