import { http, HttpResponse } from 'msw';
import { z } from 'zod';

import { API, fixtures, MISSING_BLOG, rateLimited, server } from '@/test/msw';

import {
  apiFetch,
  buildUrl,
  configureApiClient,
  parseRetryAfter,
  setTokenProvider,
  userAgent,
  type TokenProvider,
} from './client';
import { ApiError, NotFoundError } from './errors';

const Anything = z.unknown();
let sleeps: number[] = [];
let restore: () => void = () => undefined;

beforeEach(() => {
  sleeps = [];
  restore = configureApiClient({
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });
});
afterEach(() => {
  restore();
  setTokenProvider(null);
});

function capture(path: string, method: 'get' | 'post' = 'get', body: unknown = { ok: true }) {
  const requests: Request[] = [];
  server.use(
    http[method](`${API}${path}`, ({ request }) => {
      requests.push(request.clone());
      return HttpResponse.json({ meta: { status: 200, msg: 'OK' }, response: body });
    }),
  );
  return requests;
}

function provider(overrides: Partial<TokenProvider> = {}): jest.Mocked<TokenProvider> {
  return {
    getAccessToken: jest.fn(async () => 'access-1'),
    refresh: jest.fn(async () => 'access-2'),
    onAuthFailure: jest.fn(),
    ...overrides,
  } as jest.Mocked<TokenProvider>;
}

describe('buildUrl', () => {
  it('adds query params, skips empty ones, appends api_key in apiKey mode', () => {
    const url = new URL(
      buildUrl('/v2/tagged', { tag: 'cats', before: undefined, limit: 20, x: '' }, 'apiKey'),
    );
    expect(url.origin).toBe('https://api.tumblr.com');
    expect(url.searchParams.get('tag')).toBe('cats');
    expect(url.searchParams.get('limit')).toBe('20');
    expect(url.searchParams.has('before')).toBe(false);
    expect(url.searchParams.has('x')).toBe(false);
    expect(url.searchParams.get('api_key')).toBe('test');
  });

  it.each(['bearer', 'none'] as const)('omits api_key in %s mode', (auth) => {
    expect(buildUrl('/v2/user/info', {}, auth)).not.toContain('api_key');
  });
});

describe('apiFetch', () => {
  it('sends the User-Agent and unwraps + validates the envelope', async () => {
    const requests = capture('/v2/thing', 'get', { value: 42 });
    const result = await apiFetch('/v2/thing', { schema: z.object({ value: z.number() }) });
    expect(result).toEqual({ value: 42 });
    expect(requests[0]?.headers.get('user-agent')).toBe(userAgent());
    expect(userAgent()).toMatch(/^TumblrGallery\/\S+ \(Android\)$/);
  });

  it('sends Bearer and no api_key in bearer mode', async () => {
    setTokenProvider(provider());
    const requests = capture('/v2/user/info');
    await apiFetch('/v2/user/info', { auth: 'bearer', schema: Anything });
    expect(requests[0]?.headers.get('authorization')).toBe('Bearer access-1');
    expect(requests[0]?.url).not.toContain('api_key');
  });

  it('rejects bearer calls when no token is available', async () => {
    await expect(
      apiFetch('/v2/user/info', { auth: 'bearer', schema: Anything }),
    ).rejects.toMatchObject({
      status: 401,
      code: 'not_authenticated',
    });
  });

  it('encodes form bodies', async () => {
    setTokenProvider(provider());
    const requests = capture('/v2/user/like', 'post', []);
    await apiFetch('/v2/user/like', {
      method: 'POST',
      auth: 'bearer',
      bodyType: 'form',
      body: { id: '123', reblog_key: 'abc' },
      schema: Anything,
    });
    expect(requests[0]?.headers.get('content-type')).toBe('application/x-www-form-urlencoded');
    expect(await requests[0]?.text()).toBe('id=123&reblog_key=abc');
  });

  it('throws NotFoundError on 404 with envelope details', async () => {
    const error = await apiFetch(`/v2/blog/${MISSING_BLOG}/info`, { schema: Anything }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, detail: fixtures.error404.errors[0]?.detail });
  });

  it('throws ApiError(schema_mismatch) when the response does not match', async () => {
    capture('/v2/thing', 'get', { value: 'not a number' });
    await expect(
      apiFetch('/v2/thing', { schema: z.object({ value: z.number() }) }),
    ).rejects.toMatchObject({ code: 'schema_mismatch' });
  });

  it('treats meta.status >= 400 in a 200 response as an error', async () => {
    server.use(
      http.get(`${API}/v2/odd`, () =>
        HttpResponse.json({ meta: { status: 400, msg: 'Bad Request' }, response: [] }),
      ),
    );
    await expect(apiFetch('/v2/odd', { schema: Anything })).rejects.toMatchObject({ status: 400 });
  });

  describe('429 backoff', () => {
    it('retries with 1s/2s/4s backoff then throws with retryAfterSec', async () => {
      let calls = 0;
      server.use(http.get(`${API}/v2/tagged`, () => (calls++, rateLimited())));
      const error = await apiFetch('/v2/tagged', { schema: Anything }).catch((e: unknown) => e);
      expect(calls).toBe(4);
      expect(sleeps).toEqual([1000, 2000, 4000]);
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).isRateLimited).toBe(true);
    });

    it('honours Retry-After and succeeds once the limit clears', async () => {
      let calls = 0;
      server.use(
        http.get(`${API}/v2/tagged`, () =>
          ++calls < 3 ? rateLimited(7) : HttpResponse.json(fixtures.tagged),
        ),
      );
      const result = await apiFetch('/v2/tagged', { schema: z.array(z.unknown()) });
      expect(result).toHaveLength(fixtures.tagged.response.length);
      expect(sleeps).toEqual([7000, 7000]);
    });

    it('surfaces Retry-After on the final error', async () => {
      server.use(http.get(`${API}/v2/tagged`, () => rateLimited(12)));
      await expect(apiFetch('/v2/tagged', { schema: Anything })).rejects.toMatchObject({
        status: 429,
        retryAfterSec: 12,
      });
    });
  });

  describe('401 in bearer mode', () => {
    it('refreshes once and retries with the new token', async () => {
      const p = provider();
      setTokenProvider(p);
      const seen: (string | null)[] = [];
      server.use(
        http.get(`${API}/v2/user/info`, ({ request }) => {
          const auth = request.headers.get('authorization');
          seen.push(auth);
          return auth === 'Bearer access-2'
            ? HttpResponse.json(fixtures.userInfo)
            : HttpResponse.json(
                { meta: { status: 401, msg: 'Unauthorized' }, response: [] },
                { status: 401 },
              );
        }),
      );
      await apiFetch('/v2/user/info', { auth: 'bearer', schema: Anything });
      expect(seen).toEqual(['Bearer access-1', 'Bearer access-2']);
      expect(p.refresh).toHaveBeenCalledTimes(1);
      expect(p.onAuthFailure).not.toHaveBeenCalled();
    });

    it('calls onAuthFailure when refresh fails', async () => {
      const p = provider({ refresh: jest.fn(async () => null) });
      setTokenProvider(p);
      server.use(http.get(`${API}/v2/user/info`, () => new HttpResponse(null, { status: 401 })));
      await expect(
        apiFetch('/v2/user/info', { auth: 'bearer', schema: Anything }),
      ).rejects.toMatchObject({
        status: 401,
      });
      expect(p.onAuthFailure).toHaveBeenCalledTimes(1);
    });

    it('calls onAuthFailure when the retried request is still 401', async () => {
      const p = provider();
      setTokenProvider(p);
      server.use(http.get(`${API}/v2/user/info`, () => new HttpResponse(null, { status: 401 })));
      await expect(
        apiFetch('/v2/user/info', { auth: 'bearer', schema: Anything }),
      ).rejects.toBeInstanceOf(ApiError);
      expect(p.refresh).toHaveBeenCalledTimes(1);
      expect(p.onAuthFailure).toHaveBeenCalledTimes(1);
    });

    it('does not refresh on 401 in apiKey mode', async () => {
      const p = provider();
      setTokenProvider(p);
      server.use(http.get(`${API}/v2/tagged`, () => new HttpResponse(null, { status: 401 })));
      await expect(apiFetch('/v2/tagged', { schema: Anything })).rejects.toMatchObject({
        status: 401,
      });
      expect(p.refresh).not.toHaveBeenCalled();
    });
  });
});

describe('parseRetryAfter', () => {
  it.each([
    [null, undefined],
    ['5', 5],
    ['0', 0],
    ['garbage', undefined],
  ])('%p → %p', (header, expected) => expect(parseRetryAfter(header)).toBe(expected));

  it('parses HTTP dates', () => {
    const now = Date.parse('2026-10-31T10:00:00Z');
    expect(parseRetryAfter('Sat, 31 Oct 2026 10:00:30 GMT', now)).toBe(30);
  });
});
