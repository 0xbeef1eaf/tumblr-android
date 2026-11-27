import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import { http, HttpResponse } from 'msw';

import { setTokenProvider } from '@/api/client';
import { resetAuthState, signInForTest } from '@/features/auth/auth.testutil';
import { useAuthStore } from '@/features/auth/authStore';
import { API, fixtures, server } from '@/test/msw';
import { renderWithProviders } from '@/test/render';

import NotificationsRoute from '../../../app/(tabs)/notifications';

const PATH = '/v2/blog/pixelwanderer/notifications';
const ok = (response: unknown) => HttpResponse.json({ meta: { status: 200, msg: 'OK' }, response });

function recordRequests(): URL[] {
  const urls: URL[] = [];
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url);
    if (url.pathname === PATH) urls.push(url);
  });
  return urls;
}

beforeEach(() => resetAuthState());
afterEach(() => {
  setTokenProvider(null);
  server.events.removeAllListeners();
  jest.restoreAllMocks();
});

describe('notifications route', () => {
  it('asks guests to sign in without calling the API', async () => {
    const urls = recordRequests();
    await renderWithProviders(<NotificationsRoute />);
    expect(screen.getByTestId('sign-in-prompt')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in with Tumblr' })).toBeTruthy();
    expect(urls).toHaveLength(0);
  });

  it('shows a spinner while the session restores', async () => {
    useAuthStore.getState().setLoading();
    await renderWithProviders(<NotificationsRoute />);
    expect(screen.getByTestId('notifications-session-loading')).toBeTruthy();
  });

  it('renders a sentence per notification type for the primary blog', async () => {
    const urls = recordRequests();
    signInForTest();
    await renderWithProviders(<NotificationsRoute />);
    expect(screen.getByTestId('notifications-loading')).toBeTruthy();
    expect(await screen.findByText('northlight-studio liked your post')).toBeTruthy();
    expect(screen.getByText('tiny-cat-daily reblogged your post')).toBeTruthy();
    expect(screen.getByText('“this light is unreal”')).toBeTruthy();
    expect(screen.getByText('quiet-frames reblogged your post')).toBeTruthy();
    expect(screen.getByText('harbourlights replied:')).toBeTruthy();
    expect(screen.getByText('“Where was this taken?”')).toBeTruthy();
    expect(screen.getByText('mossandstone started following you')).toBeTruthy();
    expect(screen.getByText('curious-cat sent you an ask')).toBeTruthy();
    expect(screen.getByText('film-diary mentioned you')).toBeTruthy();
    expect(screen.getByText('glitch-garden interacted with your post')).toBeTruthy();
    expect(screen.queryByText(/no-id-so-dropped/)).toBeNull();
    // Unread rows carry a dot; the first two fixture items are unread.
    expect(screen.getAllByTestId('unread-dot')).toHaveLength(2);
    expect(
      within(screen.getByTestId('notification-n-1001')).getByTestId('notification-thumbnail'),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('notification-n-1005')).queryByTestId('notification-thumbnail'),
    ).toBeNull();
    expect(urls[0]?.searchParams.has('before')).toBe(false);
  });

  it('opens the post, the follower blog, or the avatar blog on press', async () => {
    const push = jest.spyOn(router, 'push').mockImplementation(() => undefined);
    signInForTest();
    await renderWithProviders(<NotificationsRoute />);
    await screen.findByTestId('notification-n-1001');
    await fireEvent.press(screen.getByTestId('notification-n-1001'));
    expect(push).toHaveBeenLastCalledWith('/post/pixelwanderer/742388497658807856');
    await fireEvent.press(screen.getByTestId('notification-n-1005'));
    expect(push).toHaveBeenLastCalledWith('/blog/mossandstone');
    await fireEvent.press(screen.getByTestId('notification-avatar-n-1002'));
    expect(push).toHaveBeenLastCalledWith('/blog/tiny-cat-daily');
  });

  it('pages with the before cursor and stops when the cursor repeats', async () => {
    const urls = recordRequests();
    signInForTest();
    await renderWithProviders(<NotificationsRoute />);
    await screen.findByTestId('notification-n-1001');
    await act(async () => {
      screen.getByTestId('notifications-list').props.onEndReached();
    });
    await waitFor(() => expect(urls).toHaveLength(2));
    expect(urls[1]?.searchParams.get('before')).toBe('1761700000');
    // The fixture's next cursor is the same again: no third request.
    await act(async () => {
      screen.getByTestId('notifications-list').props.onEndReached();
    });
    expect(urls).toHaveLength(2);
    // Duplicate ids across pages are shown once.
    expect(screen.getAllByTestId('notification-n-1001')).toHaveLength(1);
  });

  it('filters with types[]', async () => {
    const urls = recordRequests();
    signInForTest();
    await renderWithProviders(<NotificationsRoute />);
    await screen.findByTestId('notification-n-1001');
    await fireEvent.press(screen.getByTestId('notification-filter-reblogs'));
    await waitFor(() => expect(urls).toHaveLength(2));
    expect(urls[1]?.searchParams.getAll('types[]')).toEqual([
      'reblog_naked',
      'reblog_with_content',
    ]);
  });

  it('shows an empty state', async () => {
    server.use(http.get(`${API}${PATH}`, () => ok({ notifications: [] })));
    signInForTest();
    await renderWithProviders(<NotificationsRoute />);
    expect(await screen.findByText('No notifications yet')).toBeTruthy();
  });

  it('filters follows with the documented follow type', async () => {
    const urls = recordRequests();
    signInForTest();
    await renderWithProviders(<NotificationsRoute />);
    await screen.findByTestId('notification-n-1001');
    await fireEvent.press(screen.getByTestId('notification-filter-follows'));
    await waitFor(() => expect(urls).toHaveLength(2));
    expect(urls[1]?.searchParams.getAll('types[]')).toEqual(['follow']);
  });

  it('shows a filter-specific empty state with a way back to all', async () => {
    const urls = recordRequests();
    server.use(
      http.get(`${API}${PATH}`, ({ request }) =>
        new URL(request.url).searchParams.has('types[]')
          ? ok({ notifications: [] })
          : ok(fixtures.notifications.response),
      ),
    );
    signInForTest();
    await renderWithProviders(<NotificationsRoute />);
    await screen.findByTestId('notification-n-1001');
    await fireEvent.press(screen.getByTestId('notification-filter-mentions'));
    expect(await screen.findByTestId('notifications-empty-filtered')).toBeTruthy();
    expect(screen.getByText('No mentions yet')).toBeTruthy();
    expect(screen.queryByText('No notifications yet')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Show all' }));
    expect(await screen.findByTestId('notification-n-1001')).toBeTruthy();
    expect(screen.getByTestId('notification-filter-all').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    expect(urls.length).toBeGreaterThanOrEqual(2);
  });

  it('offers a retry when a later page fails, keeping loaded rows', async () => {
    let failNext = true;
    server.use(
      http.get(`${API}${PATH}`, ({ request }) => {
        if (!new URL(request.url).searchParams.has('before')) {
          return ok(fixtures.notifications.response);
        }
        if (failNext) {
          return HttpResponse.json({ meta: { status: 500, msg: 'Oops' } }, { status: 500 });
        }
        return ok({
          notifications: [
            { id: 'n-2001', type: 'like', timestamp: 1761500000, from_tumblelog_name: 'page-two' },
          ],
        });
      }),
    );
    signInForTest();
    await renderWithProviders(<NotificationsRoute />);
    await screen.findByTestId('notification-n-1001');
    await act(async () => {
      screen.getByTestId('notifications-list').props.onEndReached();
    });
    expect(await screen.findByTestId('notifications-load-more-error')).toBeTruthy();
    expect(screen.getByTestId('notification-n-1001')).toBeTruthy();
    expect(screen.queryByTestId('notifications-error')).toBeNull();

    failNext = false;
    await fireEvent.press(screen.getByTestId('notifications-load-more-retry'));
    expect(await screen.findByText('page-two liked your post')).toBeTruthy();
    expect(screen.queryByTestId('notifications-load-more-error')).toBeNull();
  });

  it('explains a 403 from Tumblr', async () => {
    server.use(
      http.get(`${API}${PATH}`, () =>
        HttpResponse.json({ meta: { status: 403, msg: 'Forbidden' } }, { status: 403 }),
      ),
    );
    signInForTest();
    await renderWithProviders(<NotificationsRoute />);
    expect(await screen.findByTestId('notifications-forbidden')).toBeTruthy();
  });

  it('retries after other errors', async () => {
    let fail = true;
    server.use(
      http.get(`${API}${PATH}`, () =>
        fail
          ? HttpResponse.json({ meta: { status: 500, msg: 'Oops' } }, { status: 500 })
          : ok(fixtures.notifications.response),
      ),
    );
    signInForTest();
    await renderWithProviders(<NotificationsRoute />);
    expect(await screen.findByTestId('notifications-error')).toBeTruthy();
    fail = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('northlight-studio liked your post')).toBeTruthy();
  });

  it('explains when the account has no blog', async () => {
    useAuthStore.getState().setSignedIn({ name: 'nobody' });
    await renderWithProviders(<NotificationsRoute />);
    expect(screen.getByTestId('notifications-no-blog')).toBeTruthy();
  });
});
