import { act, renderHook, waitFor } from '@testing-library/react-native';
import { delay, http, HttpResponse } from 'msw';

import { API, server } from '@/test/msw';
import { setTokenProvider } from '@/api/client';
import { useToastStore } from '@/ui/primitives/toastStore';

import { createClient, createWrapper, resetAuthState, signInForTest } from './auth.testutil';
import { useFollow } from './useFollow';
import { useFollowing } from './useFollowing';

// user.following.json lists 'northlight-studio' first.
const FOLLOWED = 'northlight-studio';
const NOT_FOLLOWED = 'somebody-else';

function recordFollowCalls() {
  const calls: { path: string; url: string | null }[] = [];
  server.events.on('request:start', async ({ request }) => {
    const path = new URL(request.url).pathname;
    if (request.method === 'POST' && /\/v2\/user\/(un)?follow$/.test(path)) {
      calls.push({ path, url: new URLSearchParams(await request.clone().text()).get('url') });
    }
  });
  return calls;
}

beforeEach(() => {
  resetAuthState();
  useToastStore.getState().clear();
});
afterEach(() => {
  server.events.removeAllListeners();
  setTokenProvider(null);
});

describe('useFollow', () => {
  it('reads follow state from the following list', async () => {
    signInForTest();
    const { result } = await renderHook(
      () => ({ followed: useFollow(FOLLOWED), other: useFollow(NOT_FOLLOWED) }),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.followed.isFollowing).toBe(true));
    expect(result.current.other.isFollowing).toBe(false);
  });

  it('unfollows optimistically, posts the blog url and refreshes the list', async () => {
    signInForTest();
    const calls = recordFollowCalls();
    const client = createClient();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const { result } = await renderHook(() => useFollow(FOLLOWED), {
      wrapper: createWrapper(client),
    });
    await waitFor(() => expect(result.current.isFollowing).toBe(true));

    await act(async () => {
      result.current.toggle();
    });
    expect(result.current.isFollowing).toBe(false);
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['following'] }));
    expect(calls).toEqual([{ path: '/v2/user/unfollow', url: `${FOLLOWED}.tumblr.com` }]);
    expect(result.current.isFollowing).toBe(false);
  });

  it('follows a new blog', async () => {
    signInForTest();
    const calls = recordFollowCalls();
    const client = createClient();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const { result } = await renderHook(() => useFollow(NOT_FOLLOWED), {
      wrapper: createWrapper(client),
    });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    await act(async () => {
      result.current.toggle();
    });
    expect(result.current.isFollowing).toBe(true);
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['following'] }));
    expect(calls[0]).toEqual({ path: '/v2/user/follow', url: `${NOT_FOLLOWED}.tumblr.com` });
  });

  it('rolls back when the request fails', async () => {
    signInForTest();
    server.use(
      http.post(`${API}/v2/user/follow`, async () => {
        await delay(100);
        return HttpResponse.json({ meta: { status: 500, msg: 'Server Error' } }, { status: 500 });
      }),
    );
    const { result } = await renderHook(() => useFollow(NOT_FOLLOWED), {
      wrapper: createWrapper(),
    });
    await act(async () => {
      result.current.toggle();
    });
    expect(result.current.isFollowing).toBe(true);
    await waitFor(() => expect(result.current.isFollowing).toBe(false));
    expect(useToastStore.getState().toasts[0]?.message).toBe(`Couldn't follow ${NOT_FOLLOWED}`);
  });

  it('asks guests to sign in instead of calling the API', async () => {
    const calls = recordFollowCalls();
    const { result } = await renderHook(() => useFollow(FOLLOWED), { wrapper: createWrapper() });
    expect(result.current.isFollowing).toBe(false);
    await act(async () => {
      result.current.toggle();
    });
    expect(calls).toHaveLength(0);
    expect(useToastStore.getState().toasts[0]?.message).toBe('Sign in to follow blogs');
  });
});

describe('useFollowing', () => {
  it('is empty for guests', async () => {
    const { result } = await renderHook(() => useFollowing(), { wrapper: createWrapper() });
    expect(result.current.blogs).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasNextPage).toBe(false);
  });

  it('lists followed blogs with offset paging', async () => {
    signInForTest();
    const offsets: (string | null)[] = [];
    server.use(
      http.get(`${API}/v2/user/following`, ({ request }) => {
        const offset = new URL(request.url).searchParams.get('offset');
        offsets.push(offset);
        const blog = (name: string) => ({ name, avatar: [], is_adult: false, is_nsfw: false });
        const first = offset === '0' || offset === null;
        return HttpResponse.json({
          meta: { status: 200, msg: 'OK' },
          response: { total_blogs: 3, blogs: first ? [blog('a'), blog('b')] : [blog('c')] },
        });
      }),
    );
    const { result } = await renderHook(() => useFollowing(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.blogs.map((b) => b.name)).toEqual(['a', 'b']));
    expect(result.current.hasNextPage).toBe(true);
    expect(result.current.total).toBe(3);
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.blogs.map((b) => b.name)).toEqual(['a', 'b', 'c']));
    expect(offsets).toEqual(['0', '2']);
    expect(result.current.hasNextPage).toBe(false);
  });
});
