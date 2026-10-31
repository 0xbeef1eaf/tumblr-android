import { http, HttpResponse } from 'msw';
import { z } from 'zod';

import { API, fixtures, rateLimited, server } from '@/test/msw';

import { apiFetch, configureApiClient, setTokenProvider, type TokenProvider } from './client';
import { ApiError } from './errors';

const Anything = z.unknown();
let sleeps: number[] = [];
let rateLimitedCalls: number[] = [];
let restore: () => void = () => undefined;

beforeEach(() => {
  sleeps = [];
  rateLimitedCalls = [];
  restore = configureApiClient({
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    onRateLimited: (sec) => rateLimitedCalls.push(sec),
  });
});
afterEach(() => {
  restore();
  setTokenProvider(null);
});

function provider(overrides: Partial<TokenProvider> = {}): jest.Mocked<TokenProvider> {
  return {
    getAccessToken: jest.fn(async () => 'access-1'),
    refresh: jest.fn(async () => 'access-2'),
    onAuthFailure: jest.fn(),
    ...overrides,
  } as jest.Mocked<TokenProvider>;
}

function captureTagged() {
  const requests: Request[] = [];
  server.use(
    http.get(`${API}/v2/tagged`, ({ request }) => {
      requests.push(request.clone());
      return HttpResponse.json(fixtures.tagged);
    }),
  );
  return requests;
}

describe("auth: 'auto'", () => {
  it('sends Bearer and no api_key when the session has a token', async () => {
    setTokenProvider(provider());
    const requests = captureTagged();
    await apiFetch('/v2/tagged', { query: { tag: 'cats' }, auth: 'auto', schema: Anything });
    expect(requests[0]?.headers.get('authorization')).toBe('Bearer access-1');
    expect(new URL(requests[0]?.url ?? '').searchParams.has('api_key')).toBe(false);
  });

  it('falls back to api_key for guests', async () => {
    const requests = captureTagged();
    await apiFetch('/v2/tagged', { query: { tag: 'cats' }, auth: 'auto', schema: Anything });
    expect(requests[0]?.headers.get('authorization')).toBeNull();
    expect(new URL(requests[0]?.url ?? '').searchParams.get('api_key')).toBe('test');
  });

  it('guest 401 does not refresh or sign out', async () => {
    const p = provider({ getAccessToken: jest.fn(async () => null) });
    setTokenProvider(p);
    server.use(http.get(`${API}/v2/tagged`, () => new HttpResponse(null, { status: 401 })));
    await expect(apiFetch('/v2/tagged', { auth: 'auto', schema: Anything })).rejects.toMatchObject({
      status: 401,
    });
    expect(p.refresh).not.toHaveBeenCalled();
    expect(p.onAuthFailure).not.toHaveBeenCalled();
  });

  it('with a token, a 401 refreshes and retries like bearer mode', async () => {
    const p = provider();
    setTokenProvider(p);
    const seen: (string | null)[] = [];
    server.use(
      http.get(`${API}/v2/tagged`, ({ request }) => {
        const auth = request.headers.get('authorization');
        seen.push(auth);
        return auth === 'Bearer access-2'
          ? HttpResponse.json(fixtures.tagged)
          : new HttpResponse(null, { status: 401 });
      }),
    );
    await apiFetch('/v2/tagged', { auth: 'auto', schema: Anything });
    expect(seen).toEqual(['Bearer access-1', 'Bearer access-2']);
    expect(p.onAuthFailure).not.toHaveBeenCalled();
  });
});

describe('429 and Retry-After', () => {
  it('retries a short Retry-After and reports each wait', async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/v2/tagged`, () =>
        ++calls < 2 ? rateLimited(5) : HttpResponse.json(fixtures.tagged),
      ),
    );
    await apiFetch('/v2/tagged', { schema: Anything });
    expect(sleeps).toEqual([5000]);
    expect(rateLimitedCalls).toEqual([5]);
  });

  it('reports exponential backoff waits in whole seconds', async () => {
    server.use(http.get(`${API}/v2/tagged`, () => rateLimited()));
    await apiFetch('/v2/tagged', { schema: Anything }).catch(() => undefined);
    expect(rateLimitedCalls).toEqual([1, 2, 4]);
  });

  it('fails at once when Retry-After exceeds the maximum wait', async () => {
    let calls = 0;
    server.use(http.get(`${API}/v2/tagged`, () => (calls++, rateLimited(120))));
    const error = await apiFetch('/v2/tagged', { schema: Anything }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 429, retryAfterSec: 120 });
    expect(calls).toBe(1);
    expect(sleeps).toEqual([]);
    expect(rateLimitedCalls).toEqual([]);
  });
});
