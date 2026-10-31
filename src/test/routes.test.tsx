import { router } from 'expo-router';
import { act, renderRouter, screen, fireEvent } from 'expo-router/testing-library';
import { Share } from 'react-native';

import { useAuthStore } from '@/features/auth/authStore';
import { sessionController } from '@/features/auth/sessionController';
import { useViewerStore } from '@/features/gallery';
import { makeItems } from '@/features/gallery/items.testutil';

/**
 * Renders the real app/ directory (path relative to the jest rootDir): every route in
 * DESIGN §2 must resolve to a screen.
 */
describe('navigation shell', () => {
  beforeEach(() => useAuthStore.getState().setGuest());
  afterEach(async () => {
    await sessionController.tokens.clearTokens();
    useAuthStore.getState().setGuest();
  });

  // Each route must mount its real screen (identified by a stable testID or text).
  it.each([
    ['/', 'sign-in'],
    ['/search', 'search-idle'],
    ['/likes', 'likes-guest-hint'],
    ['/settings', 'settings-screen'],
    ['/tag/photography', 'share-tag'],
    ['/blog/staff', 'blog-screen'],
    ['/post/staff/742388497658807856', 'post-detail'],
  ])('%s → %s', async (url, testID) => {
    await renderRouter('./app', { initialUrl: url });
    expect(await screen.findByTestId(testID)).toBeTruthy();
  });

  it('/viewer with nothing to show goes straight back to the tabs', async () => {
    await renderRouter('./app', { initialUrl: '/viewer' });
    expect(await screen.findByTestId('sign-in')).toBeTruthy();
    expect(screen.queryByTestId('viewer')).toBeNull();
  });

  it('/auth/callback finishes the auth session and goes home', async () => {
    await renderRouter('./app', { initialUrl: '/auth/callback' });
    expect(await screen.findByTestId('sign-in')).toBeTruthy();
  });

  it('/auth/callback returns to the screen sign-in started from', async () => {
    await renderRouter('./app', { initialUrl: '/tag/photography' });
    expect(await screen.findByTestId('share-tag')).toBeTruthy();
    await act(async () => {
      router.push('/auth/callback');
    });
    expect(await screen.findByTestId('share-tag')).toBeTruthy();
    expect(screen).toHavePathname('/tag/photography');
  });

  it('/definitely/not/a/route → +not-found', async () => {
    await renderRouter('./app', { initialUrl: '/definitely/not/a/route' });
    expect(await screen.findByText('+not-found')).toBeTruthy();
  });

  it('/viewer shows the pager when a gallery is open', async () => {
    useViewerStore.getState().open(makeItems(3), 1);
    await renderRouter('./app', { initialUrl: '/viewer' });
    expect(await screen.findByTestId('viewer')).toBeTruthy();
    useViewerStore.getState().close();
  });

  it('passes route params through', async () => {
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    await renderRouter('./app', { initialUrl: '/tag/photography' });
    await fireEvent.press(await screen.findByTestId('share-tag'));
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://www.tumblr.com/tagged/photography' }),
    );
  });

  it('shows tabs, hiding Dashboard for guests', async () => {
    await renderRouter('./app', { initialUrl: '/' });
    expect(await screen.findByRole('tab', { name: /Explore/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Search/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Likes/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Settings/ })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: /Dashboard/ })).toBeNull();
  });

  it('shows the Dashboard tab and route when signed in', async () => {
    // Stored tokens + a remembered user: AuthProvider's bootstrap keeps the session signed in.
    await sessionController.tokens.setTokens({
      accessToken: 'token',
      expiresAt: Date.now() + 3_600_000,
    });
    useAuthStore.getState().setSignedIn({ name: 'pixelwanderer', primaryBlog: 'pixelwanderer' });
    await renderRouter('./app', { initialUrl: '/dashboard' });
    expect(await screen.findByRole('tab', { name: /Dashboard/ })).toBeTruthy();
    expect(screen.queryByTestId('sign-in-prompt')).toBeNull();
  });

  it('does not show the dashboard to guests', async () => {
    await renderRouter('./app', { initialUrl: '/dashboard' });
    expect(screen.queryByRole('tab', { name: /Dashboard/ })).toBeNull();
  });
});
