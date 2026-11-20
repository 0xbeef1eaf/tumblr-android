import { http, HttpResponse } from 'msw';

import { API, server } from '@/test/msw';

import { setTokenProvider } from '../client';
import { ApiError, NotFoundError } from '../errors';
import { forYouCursor } from '../schemas/user';

import { getForYou } from './user';

const ok = (response: unknown) => HttpResponse.json({ meta: { status: 200, msg: 'OK' }, response });

beforeEach(() =>
  setTokenProvider({
    getAccessToken: async () => 'token',
    refresh: async () => null,
    onAuthFailure: () => undefined,
  }),
);
afterEach(() => {
  setTokenProvider(null);
  server.events.removeAllListeners();
});

describe('getForYou (undocumented /v2/tabs/for_you)', () => {
  it('sends bearer auth + cursor, keeps only post elements, reads the next cursor', async () => {
    const seen: { auth: string | null; query: Record<string, string> }[] = [];
    server.events.on('request:start', ({ request }) => {
      const url = new URL(request.url);
      if (url.pathname === '/v2/tabs/for_you') {
        seen.push({
          auth: request.headers.get('Authorization'),
          query: Object.fromEntries(url.searchParams),
        });
      }
    });
    const page = await getForYou({ cursor: 'abc', limit: 10 });
    expect(seen[0]).toEqual({ auth: 'Bearer token', query: { cursor: 'abc', limit: '10' } });
    // The fixture has 4 posts and one `object_type: 'title'` element.
    expect(page.posts).toHaveLength(4);
    expect(page.elementCount).toBe(5);
    expect(page.nextCursor).toBe('Zm9yX3lvdTpwYWdlOjI=');
  });

  it('tolerates a missing timeline and non-array elements', async () => {
    server.use(http.get(`${API}/v2/tabs/for_you`, () => ok({ something: 'else' })));
    await expect(getForYou()).resolves.toEqual({
      posts: [],
      elementCount: 0,
      nextCursor: undefined,
    });
    server.use(
      http.get(`${API}/v2/tabs/for_you`, () => ok({ timeline: { elements: null, _links: 3 } })),
    );
    await expect(getForYou()).resolves.toEqual({
      posts: [],
      elementCount: 0,
      nextCursor: undefined,
    });
  });

  it('counts non-post elements so a post-less page can still page on', async () => {
    server.use(
      http.get(`${API}/v2/tabs/for_you`, () =>
        ok({
          timeline: {
            elements: [{ object_type: 'blog_carousel' }, { object_type: 'ad' }],
            _links: { next: { href: '/v2/tabs/for_you?cursor=next2' } },
          },
        }),
      ),
    );
    await expect(getForYou()).resolves.toEqual({
      posts: [],
      elementCount: 2,
      nextCursor: 'next2',
    });
  });

  it('surfaces 403 as ApiError and 404 as NotFoundError', async () => {
    server.use(
      http.get(`${API}/v2/tabs/for_you`, () =>
        HttpResponse.json({ meta: { status: 403, msg: 'Forbidden' } }, { status: 403 }),
      ),
    );
    await expect(getForYou()).rejects.toMatchObject({ status: 403 });
    await expect(getForYou()).rejects.toBeInstanceOf(ApiError);
    server.use(
      http.get(`${API}/v2/tabs/for_you`, () =>
        HttpResponse.json({ meta: { status: 404, msg: 'Not Found' } }, { status: 404 }),
      ),
    );
    await expect(getForYou()).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('forYouCursor', () => {
  it('prefers query_params.cursor, falls back to the href, else undefined', () => {
    expect(forYouCursor({ next: { href: '/x?cursor=h', query_params: { cursor: 'q' } } })).toBe(
      'q',
    );
    expect(forYouCursor({ next: { href: '/v2/tabs/for_you?limit=20&cursor=a%3Db' } })).toBe('a=b');
    expect(forYouCursor({ next: { href: '/v2/tabs/for_you?limit=20' } })).toBeUndefined();
    expect(forYouCursor(undefined)).toBeUndefined();
  });
});
