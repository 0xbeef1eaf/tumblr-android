import { renderHook, waitFor } from '@testing-library/react-native';

import { setTokenProvider } from '@/api/client';

import { createWrapper, resetAuthState, signInForTest } from './auth.testutil';
import { useAuthStore } from './authStore';
import { toSessionUser } from './sessionUser';
import { useUser } from './useUser';

beforeEach(() => resetAuthState());
afterEach(() => setTokenProvider(null));

describe('useUser', () => {
  it('stays idle for guests', async () => {
    const { result } = await renderHook(() => useUser(), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });

  it('loads /user/info and syncs the auth store when signed in', async () => {
    signInForTest('someone');
    const { result } = await renderHook(() => useUser(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.data?.name).toBe('pixelwanderer'));
    expect(useAuthStore.getState().user).toMatchObject({
      name: 'pixelwanderer',
      primaryBlog: 'pixelwanderer',
    });
  });
});

describe('toSessionUser', () => {
  it('picks the primary blog and builds an avatar url', () => {
    const user = toSessionUser({
      name: 'me',
      blogs: [
        { name: 'side', is_adult: false, is_nsfw: false, avatar: [] },
        { name: 'main', uuid: 't:1', primary: true, is_adult: false, is_nsfw: false, avatar: [] },
      ],
    });
    expect(user).toEqual({
      name: 'me',
      primaryBlog: 'main',
      primaryBlogUuid: 't:1',
      avatarUrl: 'https://api.tumblr.com/v2/blog/main/avatar/128',
    });
  });

  it('copes with a user without blogs', () => {
    expect(toSessionUser({ name: 'me', blogs: [] })).toEqual({
      name: 'me',
      primaryBlog: undefined,
      primaryBlogUuid: undefined,
      avatarUrl: undefined,
    });
  });
});
