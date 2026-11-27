import { act, renderHook, waitFor } from '@testing-library/react-native';
import { delay, http, HttpResponse } from 'msw';

import { setTokenProvider } from '@/api/client';
import { useFollowing } from '@/features/auth';
import {
  createClient,
  createWrapper,
  resetAuthState,
  signInForTest,
} from '@/features/auth/auth.testutil';
import { API, fixtures, PRIVATE_FOLLOWING_BLOG, server } from '@/test/msw';

import { blogFollowingQueryKey, useSuggestedBlogs } from './useSuggestedBlogs';

/** `/v2/blog/{name}/following` calls, with the peak number in flight. */
function recordSourceCalls() {
  const calls: string[] = [];
  const stats = { inFlight: 0, peak: 0 };
  server.use(
    http.get(`${API}/v2/blog/:blog/following`, async ({ params }) => {
      calls.push(String(params.blog));
      stats.inFlight++;
      stats.peak = Math.max(stats.peak, stats.inFlight);
      await delay(5);
      stats.inFlight--;
      return params.blog === PRIVATE_FOLLOWING_BLOG
        ? HttpResponse.json({ meta: { status: 403, msg: 'Forbidden' } }, { status: 403 })
        : HttpResponse.json(fixtures.blogFollowing);
    }),
  );
  return { calls, stats };
}

function followingWith(names: string[], total = names.length) {
  return http.get(`${API}/v2/user/following`, () =>
    HttpResponse.json({
      meta: { status: 200, msg: 'OK' },
      response: { total_blogs: total, blogs: names.map((name) => ({ name })) },
    }),
  );
}

beforeEach(() => {
  resetAuthState();
  signInForTest();
});
afterEach(() => setTokenProvider(null));

describe('useSuggestedBlogs', () => {
  it('aggregates who followed blogs follow, minus followed and own blogs', async () => {
    const { calls } = recordSourceCalls();
    const { result } = await renderHook(() => useSuggestedBlogs(useFollowing), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // alpine-archive is already followed; pixelwanderer is the user's own blog.
    expect(result.current.suggestions.map((s) => s.name)).toEqual([
      'fernweh-frames',
      'quiet-concrete',
      'moth-and-lamp',
    ]);
    const followed = fixtures.following.response.blogs.map((b) => b.name);
    expect(result.current.suggestions[0]?.via).toEqual(followed);
    expect(calls).toEqual(followed);
  });

  it('fetches at most 15 sources, 3 at a time, and skips hidden lists', async () => {
    const { calls, stats } = recordSourceCalls();
    const names = [PRIVATE_FOLLOWING_BLOG, ...Array.from({ length: 19 }, (_, i) => `src-${i}`)];
    server.use(followingWith(names));
    const { result } = await renderHook(() => useSuggestedBlogs(useFollowing), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(calls).toHaveLength(15);
    expect(stats.peak).toBeLessThanOrEqual(3);
    expect(result.current.suggestions.length).toBeGreaterThan(0);
    expect(result.current.suggestions.every((s) => !s.via.includes(PRIVATE_FOLLOWING_BLOG))).toBe(
      true,
    );
  });

  it('caches each source list under its own key and reuses it', async () => {
    const { calls } = recordSourceCalls();
    server.use(followingWith(['northlight-studio']));
    const client = createClient();
    const first = await renderHook(() => useSuggestedBlogs(useFollowing), {
      wrapper: createWrapper(client),
    });
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    expect(client.getQueryData(blogFollowingQueryKey('northlight-studio'))).toHaveLength(5);
    await first.unmount();
    client.removeQueries({ queryKey: ['suggestedBlogs'] });

    const second = await renderHook(() => useSuggestedBlogs(useFollowing), {
      wrapper: createWrapper(client),
    });
    await waitFor(() => expect(second.result.current.suggestions).toHaveLength(4));
    expect(calls).toEqual(['northlight-studio']);
  });

  it('reads extra following pages only to exclude, sequentially and capped', async () => {
    recordSourceCalls();
    const offsets: string[] = [];
    server.use(
      http.get(`${API}/v2/user/following`, ({ request }) => {
        const offset = new URL(request.url).searchParams.get('offset') ?? '0';
        offsets.push(offset);
        const name =
          offset === '0'
            ? 'northlight-studio'
            : offset === '20'
              ? 'fernweh-frames'
              : `old-${offset}`;
        return HttpResponse.json({
          meta: { status: 200, msg: 'OK' },
          response: { total_blogs: 500, blogs: [{ name }] },
        });
      }),
    );
    const { result } = await renderHook(() => useSuggestedBlogs(useFollowing), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(offsets).toEqual(['0', '20', '21', '22', '23']);
    // fernweh-frames is on page 2 of the user's following list, so it is excluded.
    expect(result.current.suggestions.map((s) => s.name)).toEqual([
      'alpine-archive',
      'quiet-concrete',
      'moth-and-lamp',
    ]);
  });

  it('holds suggestions until the extra following pages arrive', async () => {
    recordSourceCalls();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(`${API}/v2/user/following`, async ({ request }) => {
        const offset = new URL(request.url).searchParams.get('offset') ?? '0';
        if (offset !== '0') await gate;
        const blogs =
          offset === '0' ? [{ name: 'northlight-studio' }] : [{ name: 'fernweh-frames' }];
        return HttpResponse.json({
          meta: { status: 200, msg: 'OK' },
          response: { total_blogs: 21, blogs },
        });
      }),
    );
    const seen: string[][] = [];
    const client = createClient();
    const { result } = await renderHook(
      () => {
        const value = useSuggestedBlogs(useFollowing);
        seen.push(value.suggestions.map((s) => s.name));
        return value;
      },
      { wrapper: createWrapper(client) },
    );
    // The sources have loaded, but page 2 of the user's following list has not.
    await waitFor(() =>
      expect(client.getQueryData(blogFollowingQueryKey('northlight-studio'))).toBeDefined(),
    );
    expect(result.current.suggestions).toEqual([]);
    expect(result.current.isLoading).toBe(true);

    await act(async () => release());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.suggestions.map((s) => s.name)).toEqual([
      'alpine-archive',
      'quiet-concrete',
      'moth-and-lamp',
    ]);
    // fernweh-frames (followed, on page 2) was never offered, not even briefly.
    expect(seen.every((names) => !names.includes('fernweh-frames'))).toBe(true);
  });

  it('reports an incomplete exclusion list past the extra pages', async () => {
    recordSourceCalls();
    server.use(followingWith(['northlight-studio'], 500));
    const { result } = await renderHook(() => useSuggestedBlogs(useFollowing), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.suggestions.length).toBeGreaterThan(0);
    expect(result.current.exclusionComplete).toBe(false);
  });

  it('reports a complete exclusion list when page 1 holds every follow', async () => {
    recordSourceCalls();
    server.use(followingWith(['northlight-studio']));
    const { result } = await renderHook(() => useSuggestedBlogs(useFollowing), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.exclusionComplete).toBe(true);
  });

  it('keeps rows followed from the list and does not refetch sources on a follow', async () => {
    const { calls } = recordSourceCalls();
    const client = createClient();
    const { result, rerender } = await renderHook(
      ({ keep }: { keep: ReadonlySet<string> }) => useSuggestedBlogs(useFollowing, keep),
      { wrapper: createWrapper(client), initialProps: { keep: new Set<string>() } },
    );
    await waitFor(() => expect(result.current.suggestions).toHaveLength(3));
    const before = calls.length;

    // Following fernweh-frames: it is now first in /user/following, but stays listed.
    server.use(
      followingWith(['fernweh-frames', ...fixtures.following.response.blogs.map((b) => b.name)]),
    );
    await rerender({ keep: new Set(['fernweh-frames']) });
    await act(() => client.invalidateQueries({ queryKey: ['following'] }));
    expect(result.current.suggestions.map((s) => s.name)).toEqual([
      'fernweh-frames',
      'quiet-concrete',
      'moth-and-lamp',
    ]);
    expect(calls).toHaveLength(before);
  });
});
