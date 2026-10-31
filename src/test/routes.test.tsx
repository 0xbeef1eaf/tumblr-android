import { renderRouter, screen } from 'expo-router/testing-library';

import { useAuthStore } from '@/features/auth/authStore';

/**
 * Renders the real app/ directory (path relative to the jest rootDir): every route in
 * DESIGN §2 must resolve to a screen.
 */
describe('navigation shell', () => {
  beforeEach(() => useAuthStore.getState().setGuest());

  it.each([
    ['/', '(tabs)/index'],
    ['/search', '(tabs)/search'],
    ['/likes', '(tabs)/likes'],
    ['/settings', '(tabs)/settings'],
    ['/tag/photography', 'tag/[tag]'],
    ['/blog/staff', 'blog/[name]'],
    ['/post/staff/742388497658807856', 'post/[blog]/[id]'],
    ['/viewer', 'viewer'],
    ['/auth/callback', 'auth/callback'],
    ['/definitely/not/a/route', '+not-found'],
  ])('%s → %s', async (url, label) => {
    await renderRouter('./app', { initialUrl: url });
    expect(await screen.findByText(label)).toBeTruthy();
  });

  it('passes route params through', async () => {
    await renderRouter('./app', { initialUrl: '/tag/photography' });
    expect(await screen.findByText('#photography')).toBeTruthy();
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
    useAuthStore.getState().setSignedIn({ name: 'pixelwanderer' });
    await renderRouter('./app', { initialUrl: '/dashboard' });
    expect(await screen.findByText('(tabs)/dashboard')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Dashboard/ })).toBeTruthy();
  });

  it('does not show the dashboard to guests', async () => {
    await renderRouter('./app', { initialUrl: '/dashboard' });
    expect(screen.queryByText('(tabs)/dashboard')).toBeNull();
  });
});
