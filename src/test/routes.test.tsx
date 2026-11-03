import { router } from 'expo-router';
import { act, renderRouter, screen, fireEvent, within } from 'expo-router/testing-library';
import { Share } from 'react-native';

import { useAuthStore } from '@/features/auth/authStore';
import { useOAuthFlowStore } from '@/features/auth/oauthFlowStore';
import { sessionController } from '@/features/auth/sessionController';
import { useViewerStore } from '@/features/gallery';
import { makeItems } from '@/features/gallery/items.testutil';

import { loadRequest, lastWebViewProps } from './webview';

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
    ['/dashboard', 'sign-in-prompt'],
    ['/for-you', 'sign-in-prompt'],
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

  it('a cold start at / lands on Dashboard; Explore stays routable at /', async () => {
    await renderRouter('./app', { initialUrl: '/' });
    expect(await screen.findByTestId('sign-in-prompt')).toBeTruthy();
    expect(screen).toHavePathname('/dashboard');
    await act(async () => {
      router.navigate('/');
    });
    expect(await screen.findByTestId('sign-in')).toBeTruthy();
    expect(screen).toHavePathname('/');
  });

  it('/viewer with nothing to show goes straight back to the tabs (Dashboard)', async () => {
    await renderRouter('./app', { initialUrl: '/viewer' });
    expect(await screen.findByTestId('sign-in-prompt')).toBeTruthy();
    expect(screen.queryByTestId('viewer')).toBeNull();
  });

  it('/auth/sign-in with no pending flow goes straight back to the tabs', async () => {
    await renderRouter('./app', { initialUrl: '/auth/sign-in' });
    expect(await screen.findByTestId('sign-in-prompt')).toBeTruthy();
    expect(screen.queryByTestId('sign-in-webview')).toBeNull();
  });

  it('/auth/sign-in shows the WebView and returns where sign-in started', async () => {
    const callback = 'https://0xbeef1eaf.github.io/tumblr-android/auth/callback';
    await renderRouter('./app', { initialUrl: '/tag/photography' });
    expect(await screen.findByTestId('share-tag')).toBeTruthy();
    const result = useOAuthFlowStore
      .getState()
      .begin({ url: 'https://www.tumblr.com/oauth2/authorize', state: 's', redirectUri: callback });
    await act(async () => {
      router.push('/auth/sign-in');
    });
    expect(await screen.findByTestId('sign-in-webview')).toBeTruthy();
    expect(screen).toHavePathname('/auth/sign-in');
    await act(async () => {
      lastWebViewProps().onShouldStartLoadWithRequest?.(loadRequest(`${callback}?code=c&state=s`));
    });
    await expect(result).resolves.toEqual({ status: 'success', code: 'c', redirectUri: callback });
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

  const TAB_ORDER = ['Dashboard', 'For You', 'Search', 'Explore', 'Likes', 'Settings'];
  const tabLabels = () =>
    screen
      .getAllByRole('tab')
      .map((tab) => TAB_ORDER.find((label) => within(tab).queryByText(label) !== null));

  it('shows every tab to guests, in order, with Dashboard and For You prompting sign-in', async () => {
    await renderRouter('./app', { initialUrl: '/dashboard' });
    expect(await screen.findByTestId('sign-in-prompt')).toBeTruthy();
    expect(tabLabels()).toEqual(TAB_ORDER);
    await fireEvent.press(screen.getByRole('tab', { name: /For You/ }));
    expect(screen).toHavePathname('/for-you');
    expect(
      await screen.findByText('Sign in to Tumblr to see photos, GIFs and video picked for you.'),
    ).toBeTruthy();
  });

  it('shows the Dashboard and For You feeds when signed in', async () => {
    // Stored tokens + a remembered user: AuthProvider's bootstrap keeps the session signed in.
    await sessionController.tokens.setTokens({
      accessToken: 'token',
      expiresAt: Date.now() + 3_600_000,
    });
    useAuthStore.getState().setSignedIn({ name: 'pixelwanderer', primaryBlog: 'pixelwanderer' });
    await renderRouter('./app', { initialUrl: '/dashboard' });
    expect(await screen.findByRole('tab', { name: /Dashboard/ })).toBeTruthy();
    expect(tabLabels()).toEqual(TAB_ORDER);
    expect(screen.queryByTestId('sign-in-prompt')).toBeNull();

    await act(async () => {
      router.navigate('/for-you');
    });
    expect(await screen.findByTestId('for-you-gallery')).toBeTruthy();
    expect(screen.queryByTestId('sign-in-prompt')).toBeNull();
  });
});
