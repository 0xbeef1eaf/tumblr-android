import { z } from 'zod';

import { env as defaultEnv, type Env } from '@/lib/env';
import { createLogger } from '@/lib/log';

import { userAgent } from './client';
import { getEffectiveCredentials, type EffectiveCredentials } from './credentials';
import { ApiError } from './errors';

/**
 * OAuth2 plumbing: token store, exchange/refresh HTTP calls and authorization-response
 * validation. The interactive flow lives in `features/auth/oauth.ts` (expo-auth-session) and
 * the `TokenProvider` in `features/auth/tokenProvider.ts`.
 */
const logger = createLogger('auth');

export const AUTHORIZE_URL = 'https://www.tumblr.com/oauth2/authorize';
export const TOKEN_URL = 'https://api.tumblr.com/v2/oauth2/token';
export const OAUTH_SCOPES = ['basic', 'write', 'offline_access'] as const;
/** Discovery document for `expo-auth-session` (Tumblr has no `.well-known` endpoint). */
export const AUTH_DISCOVERY = {
  authorizationEndpoint: AUTHORIZE_URL,
  tokenEndpoint: TOKEN_URL,
} as const;
export const REDIRECT_URI = 'tumblrgallery://auth/callback';
export const TOKEN_STORE_KEY = 'tumblr.oauth.tokens';

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  /** Epoch milliseconds. */
  expiresAt: number;
  scope?: string;
}

export interface TokenStore {
  load(): Promise<TokenSet | null>;
  save(tokens: TokenSet): Promise<void>;
  clear(): Promise<void>;
}

const TokenSetSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  expiresAt: z.number(),
  scope: z.string().optional(),
});

export function createMemoryTokenStore(initial: TokenSet | null = null): TokenStore {
  let current = initial;
  return {
    load: async () => current,
    save: async (tokens) => {
      current = tokens;
    },
    clear: async () => {
      current = null;
    },
  };
}

function createSecureTokenStore(): TokenStore {
  // Lazy require keeps the native module out of non-native contexts.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const SecureStore = require('expo-secure-store') as typeof import('expo-secure-store');
  return {
    load: async () => {
      const raw = await SecureStore.getItemAsync(TOKEN_STORE_KEY);
      if (!raw) return null;
      try {
        const parsed = TokenSetSchema.safeParse(JSON.parse(raw));
        return parsed.success ? parsed.data : null;
      } catch {
        logger.warn('Discarding unreadable stored tokens');
        return null;
      }
    },
    save: (tokens) => SecureStore.setItemAsync(TOKEN_STORE_KEY, JSON.stringify(tokens)),
    clear: () => SecureStore.deleteItemAsync(TOKEN_STORE_KEY),
  };
}

const isJest = typeof process !== 'undefined' && process.env.JEST_WORKER_ID != null;

/** Tokens never touch MMKV/AsyncStorage; SecureStore on device, memory under jest. */
export const secureTokenStore: TokenStore = isJest
  ? createMemoryTokenStore()
  : createSecureTokenStore();

export const TokenResponseSchema = z.looseObject({
  access_token: z.string().min(1),
  expires_in: z.number().catch(2520),
  token_type: z.string().optional(),
  scope: z.string().optional(),
  refresh_token: z.string().optional(),
});
export type TokenResponse = z.infer<typeof TokenResponseSchema>;

export function tokenSetFromResponse(response: TokenResponse, now = Date.now()): TokenSet {
  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    expiresAt: now + response.expires_in * 1000,
    scope: response.scope,
  };
}

/** True when the access token expires within `skewMs` (default 60 s). */
export function isExpiring(tokens: TokenSet, now = Date.now(), skewMs = 60_000): boolean {
  return tokens.expiresAt - now <= skewMs;
}

/** Authorize URL for a consumer key (the interactive flow uses expo-auth-session instead). */
export function buildAuthorizeUrl(state: string, redirectUri: string, clientId: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    scope: OAUTH_SCOPES.join(' '),
    state,
    redirect_uri: redirectUri,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export interface AuthDeps {
  env?: Env;
  /** Defaults to `getEffectiveCredentials(env)`, read at call time. */
  credentials?: EffectiveCredentials;
  now?: () => number;
}

type Grant =
  | { grant_type: 'authorization_code'; code: string; redirect_uri: string }
  | { grant_type: 'refresh_token'; refresh_token: string };

export class AuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthConfigError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const MISSING_KEY_MESSAGE =
  "Add your Tumblr app's consumer key and secret in Settings to sign in";
export const MISSING_SECRET_MESSAGE =
  "Add your Tumblr app's consumer secret in Settings to sign in";
export const RELEASE_ENV_SECRET_MESSAGE =
  "This build's EXPO_PUBLIC_TUMBLR_CLIENT_SECRET is only honoured in development. " +
  "Add your own Tumblr app's consumer key and secret in Settings to sign in.";

/** Read at call time so tests can flip it; production bundles define it as `false`. */
function isDevBuild(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

export interface TokenEndpoint {
  url: string;
  clientId: string;
  /** Sent only on a direct call to Tumblr; a proxy adds its own. */
  secret?: string;
}

/**
 * Where to send a grant:
 * 1. a consumer secret entered in Settings → Tumblr directly, in every build (it is the
 *    user's own app on their own device);
 * 2. a secret baked into the build (`EXPO_PUBLIC_TUMBLR_CLIENT_SECRET`) → Tumblr directly,
 *    development builds only;
 * 3. `EXPO_PUBLIC_TOKEN_EXCHANGE_URL` → the proxy, which adds the secret;
 * 4. otherwise an `AuthConfigError` pointing the user at Settings.
 */
export function resolveTokenEndpoint(
  credentials: EffectiveCredentials = getEffectiveCredentials(),
  e: Env = defaultEnv,
): TokenEndpoint {
  const { consumerKey, consumerSecret, source } = credentials;
  if (!consumerKey) throw new AuthConfigError(MISSING_KEY_MESSAGE);
  if (consumerSecret && (source === 'user' || isDevBuild())) {
    return { url: TOKEN_URL, clientId: consumerKey, secret: consumerSecret };
  }
  if (e.tokenExchangeUrl) return { url: e.tokenExchangeUrl, clientId: consumerKey };
  throw new AuthConfigError(consumerSecret ? RELEASE_ENV_SECRET_MESSAGE : MISSING_SECRET_MESSAGE);
}

/** Throws `AuthConfigError` when sign-in cannot complete (checked before opening the browser). */
export function assertSignInConfigured(deps: Pick<AuthDeps, 'env' | 'credentials'> = {}): void {
  const e = deps.env ?? defaultEnv;
  resolveTokenEndpoint(deps.credentials ?? getEffectiveCredentials(e), e);
}

async function postGrant(grant: Grant, deps: AuthDeps): Promise<TokenSet> {
  const e = deps.env ?? defaultEnv;
  const now = deps.now ?? Date.now;
  const { url, clientId, secret } = resolveTokenEndpoint(
    deps.credentials ?? getEffectiveCredentials(e),
    e,
  );
  const body = {
    ...grant,
    client_id: clientId,
    ...(secret ? { client_secret: secret } : {}),
  };
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': userAgent(),
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json: unknown;
  try {
    json = text ? (JSON.parse(text) as unknown) : undefined;
  } catch {
    json = undefined;
  }
  if (!response.ok) {
    const error = z
      .looseObject({ error: z.string().optional(), error_description: z.string().optional() })
      .safeParse(json);
    throw new ApiError({
      status: response.status,
      code: error.success ? error.data.error : undefined,
      detail: error.success ? error.data.error_description : undefined,
      message:
        grant.grant_type === 'refresh_token' && response.status === 401
          ? 'Refresh token is no longer valid'
          : 'Token exchange failed',
    });
  }
  // Tumblr returns the bare token object; a proxy may wrap it in the API envelope.
  const candidate =
    typeof json === 'object' && json !== null && 'response' in json
      ? (json as { response: unknown }).response
      : json;
  const parsed = TokenResponseSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new ApiError({ status: response.status, code: 'invalid_token_response' });
  }
  return tokenSetFromResponse(parsed.data, now());
}

/** Exchange an authorization code for tokens. */
export function exchangeCode(code: string, redirectUri: string, deps: AuthDeps = {}) {
  return postGrant({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }, deps);
}

/** Refresh tokens. Rejects with `ApiError` status 401 when the refresh token is dead. */
export async function refreshToken(rt: string, deps: AuthDeps = {}): Promise<TokenSet> {
  const tokens = await postGrant({ grant_type: 'refresh_token', refresh_token: rt }, deps);
  // Tumblr may omit a rotated refresh token; keep the old one in that case.
  return { ...tokens, refreshToken: tokens.refreshToken ?? rt };
}

export class OAuthError extends Error {
  readonly code: 'state_mismatch' | 'access_denied' | 'missing_code' | 'provider_error';

  constructor(code: OAuthError['code'], message: string) {
    super(message);
    this.name = 'OAuthError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Validate the query params Tumblr redirected back with. `state` must match the value sent
 * (CSRF protection); an `error` param or a missing `code` is surfaced as an `OAuthError`.
 */
export function parseAuthorizationResponse(
  params: Record<string, string | undefined>,
  expectedState: string,
): string {
  if (params.state !== expectedState) {
    throw new OAuthError('state_mismatch', 'Sign-in response did not match the request');
  }
  if (params.error) {
    throw new OAuthError(
      params.error === 'access_denied' ? 'access_denied' : 'provider_error',
      params.error_description ?? params.error,
    );
  }
  if (!params.code) throw new OAuthError('missing_code', 'Tumblr did not return a code');
  return params.code;
}
