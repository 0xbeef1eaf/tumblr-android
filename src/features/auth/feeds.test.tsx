import { renderHook, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';

import { setTokenProvider } from '@/api/client';
import { API, fixtures, server } from '@/test/msw';

import { createWrapper, makeTestItem, resetAuthState, signInForTest } from './auth.testutil';
import { useBookmarksStore } from './bookmarksStore';
import { useDashboard } from './useDashboard';
import { forYouNextCursor, useForYou } from './useForYou';
import { useLikes } from './useLikes';

beforeEach(() => resetAuthState());
afterEach(() => {
  server.events.removeAllListeners();
  setTokenProvider(null);
});

const okBody = (response: unknown) =>
  HttpResponse.json({ meta: { status: 200, msg: 'OK' }, response });

/** The fixture page once, then `next` for every later request (auto-advance fetches it). */
function fixtureThen(path: string, fixture: object, next: unknown) {
  server.use(http.get(`${API}${path}`, () => okBody(next)));
  server.use(http.get(`${API}${path}`, () => HttpResponse.json(fixture), { once: true }));
}

function recordQueries(path: string) {
  const queries: Record<string, string>[] = [];
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url);
    if (url.pathname === path) queries.push(Object.fromEntries(url.searchParams));
  });
  return queries;
}

describe('useDashboard', () => {
  it('is disabled for guests', async () => {
    const { result } = await renderHook(() => useDashboard(), { wrapper: createWrapper() });
    expect(result.current.items).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('loads gallery items and pages by offset = posts seen', async () => {
    signInForTest();
    fixtureThen('/v2/user/dashboard', fixtures.dashboard, { posts: [] });
    const queries = recordQueries('/v2/user/dashboard');
    const { result } = await renderHook(() => useDashboard(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.items.length).toBeGreaterThan(0));
    expect(queries[0]).toMatchObject({ npf: 'true', limit: '20' });
    expect(queries[0]?.offset).toBeUndefined();

    // The fixture page is too short to fill the grid, so the next page loads by itself.
    // It has 4 parseable posts (one has no id and is dropped).
    const seen = fixtures.dashboard.response.posts.filter((p) => p.id_string).length;
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
    expect(queries[1]?.offset).toBe(String(seen));
    expect(queries).toHaveLength(2);
  });
});

describe('useLikes', () => {
  it('returns local bookmarks for guests', async () => {
    useBookmarksStore.getState().toggle(makeTestItem());
    const { result } = await renderHook(() => useLikes(), { wrapper: createWrapper() });
    expect(result.current.items.map((i) => i.id)).toEqual(['742388497658807856:0']);
    expect(result.current.hasNextPage).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('loads likes marked as liked and pages with before = last liked_timestamp', async () => {
    signInForTest();
    fixtureThen('/v2/user/likes', fixtures.likes, { liked_posts: [], liked_count: 2 });
    const queries = recordQueries('/v2/user/likes');
    const { result } = await renderHook(() => useLikes(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.items.length).toBeGreaterThan(0));
    expect(result.current.items.every((i) => i.liked)).toBe(true);
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
    const last = fixtures.likes.response.liked_posts.at(-1)?.liked_timestamp;
    expect(queries[1]?.before).toBe(String(last));
  });

  it('ignores bookmarks when signed in', async () => {
    signInForTest();
    useBookmarksStore.getState().toggle(makeTestItem({ id: 'x:0', postId: 'x' }));
    const { result } = await renderHook(() => useLikes(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.items.length).toBeGreaterThan(0));
    expect(result.current.items.some((i) => i.id === 'x:0')).toBe(false);
  });
});

describe('useForYou', () => {
  it('is disabled for guests', async () => {
    const queries = recordQueries('/v2/tabs/for_you');
    const { result } = await renderHook(() => useForYou(), { wrapper: createWrapper() });
    expect(result.current.items).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(queries).toHaveLength(0);
  });

  it('loads posts and pages with the cursor from _links.next', async () => {
    signInForTest();
    fixtureThen('/v2/tabs/for_you', fixtures.forYou, { timeline: {} });
    const queries = recordQueries('/v2/tabs/for_you');
    const { result } = await renderHook(() => useForYou(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.items.length).toBeGreaterThan(0));
    expect(queries[0]?.cursor).toBeUndefined();
    expect(queries[0]?.limit).toBe('40');
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
    const cursor = fixtures.forYou.response.timeline._links.next.query_params.cursor;
    expect(queries[1]?.cursor).toBe(cursor);
  });

  it('keeps paging through a page of only non-post elements that has a cursor', async () => {
    signInForTest();
    const timeline = (elements: unknown[], cursor?: string) => ({
      timeline: {
        elements,
        ...(cursor ? { _links: { next: { href: `/v2/tabs/for_you?cursor=${cursor}` } } } : {}),
      },
    });
    const post = fixtures.forYou.response.timeline.elements.find(
      (e) => !('object_type' in e) || e.object_type === 'post',
    );
    server.use(
      http.get(`${API}/v2/tabs/for_you`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        if (cursor === null) return okBody(timeline([{ object_type: 'blog_carousel' }], 'c2'));
        if (cursor === 'c2') return okBody(timeline([post], 'c3'));
        return okBody(timeline([]));
      }),
    );
    const queries = recordQueries('/v2/tabs/for_you');
    const { result } = await renderHook(() => useForYou(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.items.length).toBeGreaterThan(0));
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
    expect(queries.map((q) => q.cursor)).toEqual([undefined, 'c2', 'c3']);
  });
});

describe('forYouNextCursor', () => {
  it('pages on while there is a cursor, even with zero posts', () => {
    expect(forYouNextCursor({ posts: [], elementCount: 3, nextCursor: 'c' })).toBe('c');
    expect(forYouNextCursor({ posts: [], elementCount: 0, nextCursor: 'c' })).toBeUndefined();
    expect(forYouNextCursor({ posts: [], elementCount: 3 })).toBeUndefined();
  });
});
