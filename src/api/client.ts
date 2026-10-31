import type { z } from 'zod';

import { env } from '@/lib/env';
import { createLogger } from '@/lib/log';

import { ApiError, NotFoundError } from './errors';
import { EnvelopeSchema, type ApiErrorDetail } from './schemas/envelope';

export { ApiError, NotFoundError, isApiError, isNotFoundError } from './errors';

const logger = createLogger('api');

export const API_BASE_URL = 'https://api.tumblr.com';

/** `auto`: Bearer when the session has a token, else `api_key` (signed-in reads get `liked`). */
export type AuthMode = 'apiKey' | 'bearer' | 'auto' | 'none';
export type QueryValue = string | number | boolean | null | undefined;

/** Implemented by WP4 (OAuth session). The default provider has no tokens. */
export interface TokenProvider {
  getAccessToken(): Promise<string | null>;
  /** Refresh the access token; resolve `null` when the refresh token is dead. */
  refresh(): Promise<string | null>;
  /** Called when a bearer request cannot be authorised (sign the user out). */
  onAuthFailure(): void;
}

const guestTokenProvider: TokenProvider = {
  getAccessToken: async () => null,
  refresh: async () => null,
  onAuthFailure: () => undefined,
};

let tokenProvider: TokenProvider = guestTokenProvider;

/** Install the session's token provider; pass `null` to reset to guest. */
export function setTokenProvider(provider: TokenProvider | null): void {
  tokenProvider = provider ?? guestTokenProvider;
}

export function getTokenProvider(): TokenProvider {
  return tokenProvider;
}

export interface ApiClientConfig {
  baseUrl: string;
  /** Delay used for 429 backoff; tests inject an instant one. */
  sleep: (ms: number) => Promise<void>;
  maxRateLimitRetries: number;
  baseBackoffMs: number;
  /** Upper bound for a server-provided Retry-After; a longer one fails at once. */
  maxRetryAfterMs: number;
  /** Told before each 429 retry (DESIGN §7 toast). Keeps `src/api` free of UI imports. */
  onRateLimited: (retryAfterSec: number) => void;
}

const defaultConfig: ApiClientConfig = {
  baseUrl: API_BASE_URL,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  maxRateLimitRetries: 3,
  baseBackoffMs: 1000,
  maxRetryAfterMs: 30_000,
  onRateLimited: () => undefined,
};

let config: ApiClientConfig = { ...defaultConfig };

/** Override client behaviour (tests). Returns a function restoring the previous config. */
export function configureApiClient(overrides: Partial<ApiClientConfig>): () => void {
  const previous = config;
  config = { ...config, ...overrides };
  return () => {
    config = previous;
  };
}

export function userAgent(): string {
  return `TumblrGallery/${env.appVersion} (Android)`;
}

export interface ApiRequestOptions<S extends z.ZodType> {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  query?: Record<string, QueryValue>;
  body?: Record<string, unknown>;
  /** `json` (default) or `form` (application/x-www-form-urlencoded). */
  bodyType?: 'json' | 'form';
  auth?: AuthMode;
  schema: S;
  signal?: AbortSignal;
}

export function buildUrl(
  path: string,
  query: Record<string, QueryValue> | undefined,
  auth: AuthMode,
): string {
  const url = new URL(path.startsWith('/') ? path : `/${path}`, config.baseUrl);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  if (auth === 'apiKey') url.searchParams.set('api_key', env.tumblrApiKey);
  return url.toString();
}

/** Parse `Retry-After` (delta-seconds or HTTP date) into seconds. */
export function parseRetryAfter(header: string | null, now = Date.now()): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds);
  const date = Date.parse(header);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, Math.ceil((date - now) / 1000));
}

function encodeBody(body: Record<string, unknown>, type: 'json' | 'form'): string {
  if (type === 'json') return JSON.stringify(body);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null) continue;
    params.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  }
  return params.toString();
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function errorFromBody(status: number, body: unknown, retryAfterSec?: number): ApiError {
  const envelope = EnvelopeSchema.safeParse(body);
  const first: ApiErrorDetail | undefined = envelope.success
    ? envelope.data.errors?.[0]
    : undefined;
  const init = {
    message: first?.title ?? (envelope.success ? envelope.data.meta.msg : undefined),
    code: first?.code,
    detail: first?.detail,
    retryAfterSec,
  };
  return status === 404 ? new NotFoundError(init) : new ApiError({ ...init, status });
}

/**
 * Typed fetch against the Tumblr API: auth (api_key / Bearer), User-Agent, envelope
 * unwrapping, 429 backoff, a single refresh-and-retry on 401, and zod validation.
 */
export async function apiFetch<S extends z.ZodType>(
  path: string,
  options: ApiRequestOptions<S>,
): Promise<z.output<S>> {
  const { method = 'GET', query, body, bodyType = 'json', schema } = options;
  let rateLimitAttempts = 0;
  let refreshed = false;
  let token: string | null = null;

  if (options.auth === 'bearer' || options.auth === 'auto') {
    token = await tokenProvider.getAccessToken();
    if (!token && options.auth === 'bearer') {
      throw new ApiError({ status: 401, message: 'Not signed in', code: 'not_authenticated' });
    }
  }
  // `auto` resolves once: with a token it behaves exactly like `bearer` (401 → refresh).
  const auth: AuthMode =
    options.auth === 'auto' ? (token ? 'bearer' : 'apiKey') : (options.auth ?? 'apiKey');
  const url = buildUrl(path, query, auth);

  for (;;) {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': userAgent(),
    };
    if (body) {
      headers['Content-Type'] =
        bodyType === 'json' ? 'application/json' : 'application/x-www-form-urlencoded';
    }
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(url, {
      method,
      headers,
      body: body ? encodeBody(body, bodyType) : undefined,
      signal: options.signal,
    });

    if (response.status === 429) {
      const retryAfterSec = parseRetryAfter(response.headers.get('Retry-After'));
      const tooLong = retryAfterSec !== undefined && retryAfterSec * 1000 > config.maxRetryAfterMs;
      if (!tooLong && rateLimitAttempts < config.maxRateLimitRetries) {
        const delay =
          retryAfterSec !== undefined
            ? retryAfterSec * 1000
            : config.baseBackoffMs * 2 ** rateLimitAttempts;
        rateLimitAttempts += 1;
        logger.warn(`429 on ${path}; retry ${rateLimitAttempts} in ${delay}ms`);
        config.onRateLimited(Math.max(1, Math.ceil(delay / 1000)));
        await config.sleep(delay);
        continue;
      }
      throw errorFromBody(429, await readJson(response), retryAfterSec);
    }

    if (response.status === 401 && auth === 'bearer') {
      if (!refreshed) {
        refreshed = true;
        token = await tokenProvider.refresh();
        if (token) continue;
      }
      tokenProvider.onAuthFailure();
      throw errorFromBody(401, await readJson(response));
    }

    const json = await readJson(response);
    const envelope = EnvelopeSchema.safeParse(json);
    const status = envelope.success ? envelope.data.meta.status : response.status;
    if (!response.ok || status >= 400) {
      throw errorFromBody(response.ok ? status : response.status, json);
    }
    if (!envelope.success) {
      throw new ApiError({
        status: response.status,
        code: 'invalid_envelope',
        message: 'Unexpected response from Tumblr',
      });
    }

    const parsed = schema.safeParse(envelope.data.response);
    if (!parsed.success) {
      logger.warn(`Schema mismatch on ${path}`, parsed.error.issues.slice(0, 5));
      throw new ApiError({
        status: response.status,
        code: 'schema_mismatch',
        message: 'Unexpected response shape from Tumblr',
        detail: parsed.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; '),
      });
    }
    return parsed.data;
  }
}
