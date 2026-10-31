import { act, renderHook, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';

import { setTokenProvider } from '@/api/client';
import { API, fixtures, server } from '@/test/msw';

import { createWrapper, makeTestItem, resetAuthState, signInForTest } from './auth.testutil';
import { useBookmarksStore } from './bookmarksStore';
import { useDashboard } from './useDashboard';
import { useLikes } from './useLikes';

beforeEach(() => resetAuthState());
afterEach(() => {
  server.events.removeAllListeners();
  setTokenProvider(null);
});

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
    const queries = recordQueries('/v2/user/dashboard');
    const { result } = await renderHook(() => useDashboard(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.items.length).toBeGreaterThan(0));
    expect(queries[0]).toMatchObject({ npf: 'true', limit: '20' });
    expect(queries[0]?.offset).toBeUndefined();
    expect(result.current.hasNextPage).toBe(true);

    // The fixture page has 4 parseable posts (one has no id and is dropped).
    const seen = fixtures.dashboard.response.posts.filter((p) => p.id_string).length;
    server.use(
      http.get(`${API}/v2/user/dashboard`, () =>
        HttpResponse.json({ meta: { status: 200, msg: 'OK' }, response: { posts: [] } }),
      ),
    );
    await act(async () => {
      await result.current.fetchNextPage();
    });
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
    const queries = recordQueries('/v2/user/likes');
    const { result } = await renderHook(() => useLikes(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.items.length).toBeGreaterThan(0));
    expect(result.current.items.every((i) => i.liked)).toBe(true);
    expect(result.current.hasNextPage).toBe(true);
    server.use(
      http.get(`${API}/v2/user/likes`, () =>
        HttpResponse.json({
          meta: { status: 200, msg: 'OK' },
          response: { liked_posts: [], liked_count: 2 },
        }),
      ),
    );
    await act(async () => {
      await result.current.fetchNextPage();
    });
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
