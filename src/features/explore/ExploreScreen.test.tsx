import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';

import { setTokenProvider } from '@/api/client';
import { credentialsStore } from '@/api/credentials';
import { fixtures, API, server } from '@/test/msw';
import { renderWithProviders } from '@/test/render';
import { useSearchHistoryStore } from '@/features/search/searchHistoryStore';

import { ExploreScreen } from './ExploreScreen';
import { STARTER_TAGS } from './starterTags';

const mockPush = jest.fn();
const mockSignIn = jest.fn();
const mockAuth: {
  status: 'guest' | 'signedIn' | 'loading';
  user: { name: string; primaryBlog?: string } | null;
  useFollowing?: () => {
    blogs: { name: string }[] | undefined;
    total?: number;
    isLoading: boolean;
  };
  useFollow?: (
    name: string,
    options?: { lookupInfo?: boolean },
  ) => { isFollowing: boolean; toggle: () => void; isPending: boolean };
} = { status: 'guest', user: null };

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: mockPush, setParams: jest.fn() }),
}));
jest.mock('@/features/auth', () => ({
  __esModule: true,
  useSession: () => ({ status: mockAuth.status, user: mockAuth.user, signIn: mockSignIn }),
  get useFollowing() {
    return mockAuth.useFollowing;
  },
  get useFollow() {
    return mockAuth.useFollow;
  },
}));

/** Render and wait for the first card's preview, so no fetch resolves after the test. */
async function renderExplore(previewStaggerMs: number) {
  const result = await renderWithProviders(<ExploreScreen previewStaggerMs={previewStaggerMs} />);
  await waitFor(() =>
    expect(result.client.getQueryState(['tagged', 'photography', 'preview'])?.status).toBe(
      'success',
    ),
  );
  return result;
}

beforeEach(() => {
  mockAuth.status = 'guest';
  mockAuth.user = null;
  mockAuth.useFollowing = undefined;
  mockAuth.useFollow = undefined;
  useSearchHistoryStore.getState().clear();
});
afterEach(() => setTokenProvider(null));

const FOLLOWED = [{ name: 'northlight-studio' }, { name: 'alpine-archive' }];

/** Signed in, following FOLLOWED; every source serves blog.following.json. */
function signInFollowing(blogs: { name: string }[] = FOLLOWED) {
  mockAuth.status = 'signedIn';
  mockAuth.user = { name: 'pixelwanderer', primaryBlog: 'pixelwanderer' };
  mockAuth.useFollowing = () => ({ blogs, total: blogs.length, isLoading: false });
  setTokenProvider({
    getAccessToken: async () => 'token',
    refresh: async () => null,
    onAuthFailure: () => undefined,
  });
}

describe('ExploreScreen', () => {
  it('renders the app name and all ten starter tags', async () => {
    const { client } = await renderWithProviders(<ExploreScreen previewStaggerMs={0} />);
    expect(screen.getByText('Tumblr Gallery')).toBeTruthy();
    expect(screen.getByText('Start here')).toBeTruthy();
    expect(STARTER_TAGS).toHaveLength(10);
    for (const tag of STARTER_TAGS) expect(screen.getByText(`#${tag}`)).toBeTruthy();
    await waitFor(() =>
      expect(
        client
          .getQueryCache()
          .findAll({ queryKey: ['tagged'] })
          .map((q) => q.state.status),
      ).toEqual(Array(10).fill('success')),
    );
  });

  it('loads 3-up previews from /tagged and caches them under the preview key', async () => {
    const requests: URL[] = [];
    server.use(
      http.get(`${API}/v2/tagged`, ({ request }) => {
        requests.push(new URL(request.url));
        return HttpResponse.json(fixtures.tagged);
      }),
    );
    const { client } = await renderWithProviders(<ExploreScreen previewStaggerMs={0} />);
    await waitFor(() => expect(requests).toHaveLength(10));
    expect(requests.every((u) => u.searchParams.get('limit') === '6')).toBe(true);
    await waitFor(() => expect(screen.getAllByTestId('expo-image').length).toBe(30));
    expect(client.getQueryData(['tagged', 'photography', 'preview'])).toHaveLength(3);
  });

  it('staggers preview requests: only the first card fetches immediately', async () => {
    const requests: string[] = [];
    server.use(
      http.get(`${API}/v2/tagged`, ({ request }) => {
        requests.push(new URL(request.url).searchParams.get('tag') ?? '');
        return HttpResponse.json(fixtures.tagged);
      }),
    );
    await renderExplore(60_000);
    await waitFor(() => expect(requests).toEqual(['photography']));
  });

  it('opens the tag gallery when a card is pressed', async () => {
    await renderExplore(60_000);
    await fireEvent.press(screen.getByTestId('starter-cats'));
    expect(mockPush).toHaveBeenCalledWith('/tag/cats');
  });

  it('hides Recent when there is no history and lists tags and blogs when there is', async () => {
    const first = await renderExplore(60_000);
    expect(screen.queryByTestId('recent-chips')).toBeNull();
    await first.unmount();

    useSearchHistoryStore.getState().add('blog', 'staff');
    useSearchHistoryStore.getState().add('tag', 'space');
    await renderExplore(60_000);
    expect(screen.getByTestId('recent-chips')).toBeTruthy();
    await fireEvent.press(within(screen.getByTestId('recent-chips')).getByLabelText('#space'));
    expect(mockPush).toHaveBeenLastCalledWith('/tag/space');
    await fireEvent.press(within(screen.getByTestId('recent-chips')).getByLabelText('staff'));
    expect(mockPush).toHaveBeenLastCalledWith('/blog/staff');
  });

  it('offers Sign in to guests', async () => {
    await renderExplore(60_000);
    await fireEvent.press(screen.getByTestId('sign-in'));
    expect(mockSignIn).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('following-row')).toBeNull();
  });

  it('shows the avatar instead of Sign in when signed in', async () => {
    mockAuth.status = 'signedIn';
    mockAuth.user = { name: 'me', primaryBlog: 'myblog' };
    await renderExplore(60_000);
    expect(screen.queryByTestId('sign-in')).toBeNull();
    await fireEvent.press(screen.getByTestId('account-avatar'));
    expect(mockPush).toHaveBeenCalledWith('/blog/myblog');
  });

  it('shows the Following row when signed in and useFollowing exists', async () => {
    mockAuth.status = 'signedIn';
    mockAuth.useFollowing = () => ({
      blogs: [{ name: 'alpine-archive' }, { name: 'tiny-cat-daily' }],
      isLoading: false,
    });
    await renderExplore(60_000);
    expect(screen.getByTestId('following-row')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('alpine-archive'));
    expect(mockPush).toHaveBeenCalledWith('/blog/alpine-archive');
  });

  it('hides Following when useFollowing is not exported, when empty, and for guests', async () => {
    mockAuth.status = 'signedIn';
    const missing = await renderExplore(60_000);
    expect(screen.queryByTestId('following-row')).toBeNull();
    await missing.unmount();

    mockAuth.useFollowing = () => ({ blogs: [], isLoading: false });
    const empty = await renderExplore(60_000);
    expect(screen.queryByTestId('following-row')).toBeNull();
    await empty.unmount();

    mockAuth.status = 'guest';
    mockAuth.useFollowing = () => ({ blogs: [{ name: 'x' }], isLoading: false });
    await renderExplore(60_000);
    expect(screen.queryByTestId('following-row')).toBeNull();
  });

  it('shows the Connect card instead of starter tags when no consumer key is set', async () => {
    const requests: string[] = [];
    server.use(
      http.get(`${API}/v2/tagged`, ({ request }) => {
        requests.push(request.url);
        return HttpResponse.json(fixtures.tagged);
      }),
    );
    await credentialsStore.clear();
    await renderWithProviders(<ExploreScreen previewStaggerMs={0} />);
    expect(screen.getByText('Connect your Tumblr app')).toBeTruthy();
    expect(screen.queryByTestId('starter-tags')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Open Settings'));
    expect(mockPush).toHaveBeenCalledWith('/settings');
    expect(requests).toHaveLength(0);

    // Entering a key in Settings swaps the card for the starter tags.
    await act(() => credentialsStore.save({ consumerKey: 'mine' }));
    expect(screen.queryByTestId('connect-app')).toBeNull();
    expect(screen.getByTestId('starter-tags')).toBeTruthy();
    await waitFor(() => expect(requests.length).toBeGreaterThan(0));
    expect(new URL(requests[0] ?? '').searchParams.get('api_key')).toBe('mine');
    await waitFor(() => expect(requests).toHaveLength(10));
  });

  it('opens Search from the search pill', async () => {
    await renderExplore(60_000);
    await fireEvent.press(screen.getByTestId('explore-search'));
    expect(mockPush).toHaveBeenCalledWith('/search');
  });

  it('suggests blogs that followed blogs follow, with who follows them', async () => {
    signInFollowing();
    await renderExplore(60_000);
    const section = await screen.findByTestId('suggested-blogs');
    expect(within(section).getByText('Blogs you might like')).toBeTruthy();
    expect(within(section).getByText('Followed by blogs you follow')).toBeTruthy();
    // alpine-archive is followed and pixelwanderer is the user's own blog.
    expect(screen.queryByTestId('suggestion-alpine-archive')).toBeNull();
    expect(screen.queryByTestId('suggestion-pixelwanderer')).toBeNull();
    const row = screen.getByTestId('suggestion-fernweh-frames');
    expect(within(row).getByText('Fernweh Frames')).toBeTruthy();
    expect(within(row).getByText('Followed by northlight-studio, alpine-archive')).toBeTruthy();
    expect(screen.getByTestId('suggestion-quiet-concrete')).toBeTruthy();
    expect(screen.getByTestId('suggestion-moth-and-lamp')).toBeTruthy();
    await fireEvent.press(within(row).getByLabelText(/^fernweh-frames\./));
    expect(mockPush).toHaveBeenCalledWith('/blog/fernweh-frames');
  });

  it('follows inline without a per-row /info lookup', async () => {
    signInFollowing();
    const followed = new Set<string>();
    const options: unknown[] = [];
    mockAuth.useFollow = (name, opts) => {
      options.push(opts);
      return {
        isFollowing: followed.has(name),
        toggle: () => followed.add(name),
        isPending: false,
      };
    };
    await renderExplore(60_000);
    await fireEvent.press(await screen.findByLabelText('Follow fernweh-frames'));
    expect(followed.has('fernweh-frames')).toBe(true);
    expect(options.every((o) => (o as { lookupInfo?: boolean }).lookupInfo === false)).toBe(true);
  });

  it('checks shown rows through blog info when the user follows more than the exclusion window', async () => {
    signInFollowing();
    mockAuth.useFollowing = () => ({ blogs: FOLLOWED, total: 500, isLoading: false });
    const options: unknown[] = [];
    // Stands in for useFollow's /info lookup reporting fernweh-frames as followed.
    mockAuth.useFollow = (name, opts) => {
      options.push(opts);
      return {
        isFollowing: name === 'fernweh-frames' && opts?.lookupInfo === true,
        toggle: () => undefined,
        isPending: false,
      };
    };
    await renderExplore(60_000);
    expect(await screen.findByLabelText('Unfollow fernweh-frames')).toBeTruthy();
    expect(
      within(screen.getByTestId('suggestion-fernweh-frames')).getByText('Following'),
    ).toBeTruthy();
    expect(options.length).toBeGreaterThan(0);
    expect(options.every((o) => (o as { lookupInfo?: boolean }).lookupInfo === true)).toBe(true);
  });

  it('shows a skeleton while loading and nothing for guests or when no one is followed', async () => {
    signInFollowing();
    mockAuth.useFollowing = () => ({ blogs: undefined, isLoading: true });
    const loading = await renderExplore(60_000);
    expect(
      within(screen.getByTestId('suggested-blogs')).getAllByTestId('skeleton', {
        includeHiddenElements: true,
      }),
    ).toHaveLength(9);
    await loading.unmount();

    signInFollowing([]);
    const empty = await renderExplore(60_000);
    expect(screen.queryByTestId('suggested-blogs')).toBeNull();
    await empty.unmount();

    mockAuth.status = 'guest';
    mockAuth.useFollowing = () => ({ blogs: FOLLOWED, isLoading: false });
    await renderExplore(60_000);
    expect(screen.queryByTestId('suggested-blogs')).toBeNull();
  });

  it('hides the section when every source hides its following list', async () => {
    signInFollowing();
    server.use(
      http.get(`${API}/v2/blog/:blog/following`, () =>
        HttpResponse.json({ meta: { status: 403, msg: 'Forbidden' } }, { status: 403 }),
      ),
    );
    const { client } = await renderExplore(60_000);
    await waitFor(() =>
      expect(client.getQueryState(['blog', 'alpine-archive', 'following'])?.status).toBe('success'),
    );
    await waitFor(() => expect(screen.queryByTestId('suggested-blogs')).toBeNull());
  });

  it('shows five suggestions, then the rest on "Show more"', async () => {
    signInFollowing();
    server.use(
      http.get(`${API}/v2/blog/:blog/following`, () =>
        HttpResponse.json({
          meta: { status: 200, msg: 'OK' },
          response: {
            total_blogs: 8,
            blogs: Array.from({ length: 8 }, (_, i) => ({ name: `pick-${i}` })),
          },
        }),
      ),
    );
    await renderExplore(60_000);
    await screen.findByTestId('suggestion-pick-0');
    expect(screen.queryByTestId('suggestion-pick-5')).toBeNull();
    await fireEvent.press(screen.getByTestId('suggested-blogs-more'));
    expect(screen.getByTestId('suggestion-pick-7')).toBeTruthy();
  });
});
