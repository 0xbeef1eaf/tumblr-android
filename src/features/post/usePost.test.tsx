import { renderHook, waitFor } from '@testing-library/react-native';

import { isNotFoundError } from '@/api/errors';
import { createClient, createWrapper } from '@/features/auth/auth.testutil';
import { MISSING_BLOG } from '@/test/msw';

import { FIXTURE_IDS } from './post.testutil';
import { postQueryKey, usePost } from './usePost';

describe('usePost', () => {
  it('fetches one post and caches it under [post, blog, id]', async () => {
    const client = createClient();
    const { result } = await renderHook(() => usePost('northlight-studio', FIXTURE_IDS.rows), {
      wrapper: createWrapper(client),
    });
    await waitFor(() => expect(result.current.data?.id_string).toBe(FIXTURE_IDS.rows));
    expect(client.getQueryData(postQueryKey('northlight-studio', FIXTURE_IDS.rows))).toBeTruthy();
    expect(postQueryKey('a', 'b')).toEqual(['post', 'a', 'b']);
  });

  it('surfaces a missing post as NotFoundError', async () => {
    const { result } = await renderHook(() => usePost(MISSING_BLOG, '1'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(isNotFoundError(result.current.error)).toBe(true);
  });

  it('stays idle without params', async () => {
    const { result } = await renderHook(() => usePost('', ''), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
  });
});
