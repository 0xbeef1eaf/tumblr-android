import { act, renderHook } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';

import { setTokenProvider } from '@/api/client';
import { API, server } from '@/test/msw';
import { useToastStore } from '@/ui/primitives/toastStore';

import { createWrapper, makeTestItem, resetAuthState, signInForTest } from './auth.testutil';
import { useReblog } from './useReblog';

const item = makeTestItem();

function captureReblogs() {
  const bodies: { path: string; body: Record<string, unknown> }[] = [];
  server.use(
    http.post(`${API}/v2/blog/:blog/posts`, async ({ request, params }) => {
      bodies.push({
        path: String(params.blog),
        body: (await request.json()) as Record<string, unknown>,
      });
      return HttpResponse.json(
        { meta: { status: 201, msg: 'Created' }, response: { id_string: '1', state: 'published' } },
        { status: 201 },
      );
    }),
  );
  return bodies;
}

beforeEach(() => {
  resetAuthState();
  useToastStore.getState().clear();
});
afterEach(() => setTokenProvider(null));

describe('useReblog', () => {
  it('reblogs to the primary blog with comment and tags', async () => {
    signInForTest('pixelwanderer');
    const bodies = captureReblogs();
    const { result } = await renderHook(() => useReblog(), { wrapper: createWrapper() });
    let ok = false;
    await act(async () => {
      ok = await result.current.reblog({ item, comment: ' lovely ', tags: ['a', 'b c'] });
    });
    expect(ok).toBe(true);
    expect(bodies).toHaveLength(1);
    expect(bodies[0]?.path).toBe('pixelwanderer');
    expect(bodies[0]?.body).toEqual({
      parent_tumblelog_uuid: item.blogUuid,
      parent_post_id: item.postId,
      reblog_key: item.reblogKey,
      content: [{ type: 'text', text: 'lovely' }],
      tags: 'a,b c',
    });
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      kind: 'success',
      message: 'Reblogged to pixelwanderer',
    });
  });

  it('looks up the parent blog uuid when the item has none', async () => {
    signInForTest('pixelwanderer');
    const bodies = captureReblogs();
    const { result } = await renderHook(() => useReblog(), { wrapper: createWrapper() });
    await act(async () => {
      await result.current.reblog({ item: { ...item, blogUuid: undefined } });
    });
    // blog.info.json fixture uuid
    expect(typeof bodies[0]?.body.parent_tumblelog_uuid).toBe('string');
    expect(bodies[0]?.body.parent_tumblelog_uuid).not.toBe('');
  });

  it('reports failure with a toast', async () => {
    signInForTest();
    server.use(
      http.post(`${API}/v2/blog/:blog/posts`, () =>
        HttpResponse.json({ meta: { status: 400, msg: 'Bad Request' } }, { status: 400 }),
      ),
    );
    const { result } = await renderHook(() => useReblog(), { wrapper: createWrapper() });
    let ok = true;
    await act(async () => {
      ok = await result.current.reblog({ item });
    });
    expect(ok).toBe(false);
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      kind: 'error',
      message: "Couldn't reblog this post",
    });
  });

  it('asks guests to sign in', async () => {
    const bodies = captureReblogs();
    const { result } = await renderHook(() => useReblog(), { wrapper: createWrapper() });
    let ok = true;
    await act(async () => {
      ok = await result.current.reblog({ item });
    });
    expect(ok).toBe(false);
    expect(bodies).toHaveLength(0);
    expect(useToastStore.getState().toasts[0]?.message).toBe('Sign in to reblog');
  });
});
