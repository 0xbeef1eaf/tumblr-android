import { act, renderHook, waitFor } from '@testing-library/react-native';
import { delay, http, HttpResponse } from 'msw';

import { setTokenProvider } from '@/api/client';
import { API, server } from '@/test/msw';
import { useToastStore } from '@/ui/primitives/toastStore';

import {
  createClient,
  createWrapper,
  makeTestItem,
  resetAuthState,
  signInForTest,
} from './auth.testutil';
import { useBookmarksStore } from './bookmarksStore';
import { useInteractionStore } from './interactionStore';
import { useEnsureLiked, useIsLiked, useLike, useToggleLike } from './useLike';

const item = makeTestItem();

function recordLikeCalls() {
  const calls: { path: string; body: URLSearchParams }[] = [];
  server.events.on('request:start', async ({ request }) => {
    const path = new URL(request.url).pathname;
    if (request.method === 'POST' && /\/v2\/user\/(un)?like$/.test(path)) {
      calls.push({ path, body: new URLSearchParams(await request.clone().text()) });
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

describe('useLike (signed in)', () => {
  beforeEach(() => signInForTest());

  it('toggles optimistically, posts id + reblog_key, and invalidates likes', async () => {
    const calls = recordLikeCalls();
    const client = createClient();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const { result } = await renderHook(() => useLike(item), { wrapper: createWrapper(client) });
    expect(result.current.liked).toBe(false);

    await act(async () => {
      result.current.toggle();
    });
    expect(result.current.liked).toBe(true); // optimistic
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(calls).toHaveLength(1);
    expect(calls[0]?.path).toBe('/v2/user/like');
    expect(Object.fromEntries(calls[0]?.body ?? [])).toEqual({
      id: item.postId,
      reblog_key: item.reblogKey,
    });
    expect(result.current.liked).toBe(true);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['likes'] });

    await act(async () => {
      result.current.toggle();
    });
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1]?.path).toBe('/v2/user/unlike');
    expect(result.current.liked).toBe(false);
  });

  it('rolls back and toasts when the server answers 500', async () => {
    server.use(
      http.post(`${API}/v2/user/like`, async () => {
        await delay(100);
        return HttpResponse.json({ meta: { status: 500, msg: 'Server Error' } }, { status: 500 });
      }),
    );
    const { result } = await renderHook(() => useLike(item), { wrapper: createWrapper() });
    await act(async () => {
      result.current.toggle();
    });
    expect(result.current.liked).toBe(true);
    await waitFor(() => expect(result.current.liked).toBe(false));
    expect(useInteractionStore.getState().likes[item.postId]).toBe(false);
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      kind: 'error',
      message: "Couldn't like this post",
    });
  });

  it('starts from the post’s own liked flag', async () => {
    const { result } = await renderHook(() => useLike({ ...item, liked: true }), {
      wrapper: createWrapper(),
    });
    expect(result.current.liked).toBe(true);
  });

  it('shares state between tiles of the same post', async () => {
    const { result } = await renderHook(
      () => ({ a: useLike(item), b: useLike({ ...item, id: `${item.postId}:1` }) }),
      { wrapper: createWrapper() },
    );
    await act(async () => {
      result.current.a.toggle();
    });
    expect(result.current.b.liked).toBe(true);
  });

  it('useToggleLike flips any item for list callbacks', async () => {
    const calls = recordLikeCalls();
    const client = createClient();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const { result } = await renderHook(() => useToggleLike(), { wrapper: createWrapper(client) });
    await act(async () => {
      result.current({ ...item, liked: true });
    });
    await waitFor(() => expect(invalidate).toHaveBeenCalled());
    expect(calls).toHaveLength(1);
    expect(calls[0]?.path).toBe('/v2/user/unlike');
  });
});

describe('useLike (guest)', () => {
  it('toggles a local bookmark without any network call', async () => {
    const calls = recordLikeCalls();
    const { result } = await renderHook(() => useLike(item), { wrapper: createWrapper() });
    expect(result.current.liked).toBe(false);
    await act(async () => {
      result.current.toggle();
    });
    expect(result.current.liked).toBe(true);
    expect(useBookmarksStore.getState().items.map((i) => i.id)).toEqual([item.id]);
    await act(async () => {
      result.current.toggle();
    });
    expect(result.current.liked).toBe(false);
    expect(calls).toHaveLength(0);
  });
});

describe('useIsLiked', () => {
  it('signed in: follows optimistic overrides over the server flag', async () => {
    signInForTest();
    const { result } = await renderHook(() => useIsLiked(), { wrapper: createWrapper() });
    expect(result.current({ ...item, liked: true })).toBe(true);
    expect(result.current(item)).toBe(false);
    await act(async () => {
      useInteractionStore.getState().setLike(item.postId, true);
    });
    expect(result.current(item)).toBe(true);
  });

  it('guest: reflects on-device bookmarks', async () => {
    const { result } = await renderHook(() => useIsLiked(), { wrapper: createWrapper() });
    expect(result.current({ ...item, liked: true })).toBe(false);
    await act(async () => {
      useBookmarksStore.getState().toggle(item);
    });
    expect(result.current(item)).toBe(true);
  });
});

describe('useEnsureLiked', () => {
  it('signed in: likes optimistically when not liked yet', async () => {
    signInForTest();
    const calls = recordLikeCalls();
    const client = createClient();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const { result } = await renderHook(() => ({ ensure: useEnsureLiked(), like: useLike(item) }), {
      wrapper: createWrapper(client),
    });
    await act(async () => {
      result.current.ensure(item);
    });
    expect(result.current.like.liked).toBe(true); // optimistic, shared with the chrome heart
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]?.path).toBe('/v2/user/like');
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['likes'] }));
    expect(result.current.like.liked).toBe(true);
  });

  it('signed in: does nothing when already liked (server flag or override)', async () => {
    signInForTest();
    const calls = recordLikeCalls();
    const { result } = await renderHook(() => useEnsureLiked(), { wrapper: createWrapper() });
    await act(async () => {
      result.current({ ...item, liked: true });
      useInteractionStore.getState().setLike('other', true);
      result.current({ ...item, id: 'other:0', postId: 'other' });
    });
    expect(calls).toHaveLength(0);
    expect(useInteractionStore.getState().likes[item.postId]).toBeUndefined();
  });

  it('guest: bookmarks once and never removes the bookmark', async () => {
    const calls = recordLikeCalls();
    const { result } = await renderHook(() => useEnsureLiked(), { wrapper: createWrapper() });
    await act(async () => {
      result.current(item);
    });
    expect(useBookmarksStore.getState().items.map((i) => i.id)).toEqual([item.id]);
    await act(async () => {
      result.current(item);
    });
    expect(useBookmarksStore.getState().items.map((i) => i.id)).toEqual([item.id]);
    expect(calls).toHaveLength(0);
  });
});
