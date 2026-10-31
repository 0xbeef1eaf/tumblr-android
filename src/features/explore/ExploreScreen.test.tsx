import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';

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
  useFollowing?: () => { blogs: { name: string }[] | undefined; isLoading: boolean };
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
  useSearchHistoryStore.getState().clear();
});

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
});
