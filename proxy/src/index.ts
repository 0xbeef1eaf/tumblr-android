/**
 * Tumblr OAuth2 token-exchange proxy (Cloudflare Worker).
 *
 * Tumblr's token endpoint needs the app's `client_secret`, which must never ship inside a
 * mobile app. The app sends the grant here; the Worker adds `client_id` / `client_secret`
 * from its secrets, forwards it to Tumblr and relays Tumblr's JSON answer unchanged.
 *
 *   POST /token   { "grant_type": "authorization_code", "code", "redirect_uri" }
 *                 { "grant_type": "refresh_token", "refresh_token" }
 *
 * Only standard Fetch API types are used so the file also runs under Node (tests).
 */

export interface Env {
  TUMBLR_CLIENT_ID?: string;
  TUMBLR_CLIENT_SECRET: string;
  /** Comma-separated exact redirect URIs the app may use. Unset = any (not recommended). */
  ALLOWED_REDIRECT_URIS?: string;
  /** Comma-separated allowed browser origins for CORS. Unset = `*` (native apps ignore CORS). */
  ALLOWED_ORIGINS?: string;
}

export const TUMBLR_TOKEN_URL = 'https://api.tumblr.com/v2/oauth2/token';
export const MAX_BODY_BYTES = 4096;
export const RATE_LIMIT = { limit: 30, windowMs: 60_000 } as const;

export interface HandlerOptions {
  fetchImpl?: typeof fetch;
  now?: () => number;
}

interface RateEntry {
  count: number;
  resetAt: number;
}
/** Best-effort, per-isolate limiter. Use Cloudflare's rate-limiting rules for hard limits. */
const hits = new Map<string, RateEntry>();

export function resetRateLimits(): void {
  hits.clear();
}

function rateLimited(ip: string, now: number): number | undefined {
  const entry = hits.get(ip);
  if (!entry || entry.resetAt <= now) {
    if (hits.size > 5000) hits.clear();
    hits.set(ip, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    return undefined;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT.limit ? Math.ceil((entry.resetAt - now) / 1000) : undefined;
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const allowed = env.ALLOWED_ORIGINS?.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const origin = request.headers.get('Origin');
  const allowOrigin = !allowed?.length ? '*' : origin && allowed.includes(origin) ? origin : '';
  return {
    ...(allowOrigin ? { 'Access-Control-Allow-Origin': allowOrigin } : {}),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(
  body: unknown,
  status: number,
  cors: Record<string, string>,
  extra: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors, ...extra },
  });
}

const oauthError = (
  error: string,
  description: string,
  status: number,
  cors: Record<string, string>,
) => json({ error, error_description: description }, status, cors);

type Grant =
  | { grant_type: 'authorization_code'; code: string; redirect_uri: string }
  | { grant_type: 'refresh_token'; refresh_token: string };

const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

/** Validate the app's request body into one of the two supported grants. */
export function parseGrant(body: unknown): Grant | { error: string; description: string } {
  if (typeof body !== 'object' || body === null) {
    return { error: 'invalid_request', description: 'Expected a JSON object' };
  }
  const input = body as Record<string, unknown>;
  if (input.grant_type === 'authorization_code') {
    if (!nonEmpty(input.code) || !nonEmpty(input.redirect_uri)) {
      return { error: 'invalid_request', description: 'code and redirect_uri are required' };
    }
    return { grant_type: 'authorization_code', code: input.code, redirect_uri: input.redirect_uri };
  }
  if (input.grant_type === 'refresh_token') {
    if (!nonEmpty(input.refresh_token)) {
      return { error: 'invalid_request', description: 'refresh_token is required' };
    }
    return { grant_type: 'refresh_token', refresh_token: input.refresh_token };
  }
  return {
    error: 'unsupported_grant_type',
    description: 'Only authorization_code and refresh_token',
  };
}

export async function handleRequest(
  request: Request,
  env: Env,
  options: HandlerOptions = {},
): Promise<Response> {
  const cors = corsHeaders(request, env);
  const doFetch = options.fetchImpl ?? fetch;
  const now = (options.now ?? Date.now)();
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (url.pathname !== '/token') return oauthError('not_found', 'Not found', 404, cors);
  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405, cors, { Allow: 'POST, OPTIONS' });
  }

  const retryAfter = rateLimited(request.headers.get('CF-Connecting-IP') ?? 'unknown', now);
  if (retryAfter !== undefined) {
    return oauthError('rate_limited', 'Too many requests', 429, {
      ...cors,
      'Retry-After': String(retryAfter),
    });
  }

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES)
    return oauthError('invalid_request', 'Body too large', 413, cors);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return oauthError('invalid_request', 'Body must be JSON', 400, cors);
  }

  const grant = parseGrant(parsed);
  if ('error' in grant) {
    return oauthError(grant.error, grant.description, 400, cors);
  }

  const clientId =
    env.TUMBLR_CLIENT_ID ?? ((parsed as Record<string, unknown>).client_id as string | undefined);
  if (!env.TUMBLR_CLIENT_SECRET || !clientId) {
    return oauthError('server_error', 'Proxy is not configured', 500, cors);
  }

  if (grant.grant_type === 'authorization_code' && env.ALLOWED_REDIRECT_URIS) {
    const allowed = env.ALLOWED_REDIRECT_URIS.split(',').map((u) => u.trim());
    if (!allowed.includes(grant.redirect_uri)) {
      return oauthError('invalid_request', 'redirect_uri is not allowed', 400, cors);
    }
  }

  const form = new URLSearchParams({
    ...grant,
    client_id: clientId,
    client_secret: env.TUMBLR_CLIENT_SECRET,
  });

  let upstream: Response;
  try {
    upstream = await doFetch(TUMBLR_TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'TumblrGallery-TokenProxy/1.0',
      },
      body: form.toString(),
    });
  } catch {
    return oauthError('server_error', 'Could not reach Tumblr', 502, cors);
  }

  // Relay Tumblr's answer (status and JSON body) verbatim; never echo secrets.
  const payload = await upstream.text();
  try {
    JSON.parse(payload);
  } catch {
    return oauthError('server_error', 'Unexpected response from Tumblr', 502, cors);
  }
  return new Response(payload, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors },
  });
}

export default {
  fetch: (request: Request, env: Env): Promise<Response> => handleRequest(request, env),
};
