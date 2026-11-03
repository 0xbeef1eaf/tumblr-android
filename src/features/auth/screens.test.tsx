import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { http, HttpResponse } from 'msw';

import { setTokenProvider } from '@/api/client';
import { API, server } from '@/test/msw';
import { renderWithProviders } from '@/test/render';

import DashboardRoute from '../../../app/(tabs)/dashboard';
import ForYouRoute from '../../../app/(tabs)/for-you';
import LikesRoute from '../../../app/(tabs)/likes';

import { makeTestItem, resetAuthState, signInForTest } from './auth.testutil';
import { useAuthStore } from './authStore';
import { useBookmarksStore } from './bookmarksStore';
import { sessionController } from './sessionController';

beforeEach(() => resetAuthState());
afterEach(() => {
  setTokenProvider(null);
  jest.restoreAllMocks();
});

describe('dashboard route', () => {
  it('shows a centered sign-in prompt to guests', async () => {
    await renderWithProviders(<DashboardRoute />);
    expect(screen.getByTestId('sign-in-prompt')).toBeTruthy();
    expect(screen.getByText('Your dashboard')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in with Tumblr' })).toBeTruthy();
  });

  it('starts the sign-in flow from the prompt', async () => {
    const signIn = jest.spyOn(sessionController, 'signIn').mockResolvedValue();
    await renderWithProviders(<DashboardRoute />);
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in with Tumblr' }));
    await waitFor(() => expect(signIn).toHaveBeenCalledTimes(1));
  });

  it('shows a spinner while the session is restoring', async () => {
    useAuthStore.getState().setLoading();
    await renderWithProviders(<DashboardRoute />);
    expect(screen.getByTestId('dashboard-loading')).toBeTruthy();
    expect(screen.queryByTestId('sign-in-prompt')).toBeNull();
  });

  it('shows the dashboard gallery when signed in', async () => {
    signInForTest();
    await renderWithProviders(<DashboardRoute />);
    expect(screen.queryByTestId('sign-in-prompt')).toBeNull();
    await waitFor(() => expect(screen.getAllByTestId('expo-image').length).toBeGreaterThan(0));
  });
});

describe('for you route', () => {
  it('shows a sign-in prompt to guests', async () => {
    await renderWithProviders(<ForYouRoute />);
    expect(screen.getByTestId('sign-in-prompt')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in with Tumblr' })).toBeTruthy();
  });

  it('shows the For You gallery when signed in', async () => {
    signInForTest();
    await renderWithProviders(<ForYouRoute />);
    expect(screen.queryByTestId('sign-in-prompt')).toBeNull();
    await waitFor(() => expect(screen.getAllByTestId('expo-image').length).toBeGreaterThan(0));
  });

  it.each([403, 404])('explains when Tumblr refuses the feed (%i)', async (status) => {
    server.use(
      http.get(`${API}/v2/tabs/for_you`, () =>
        HttpResponse.json({ meta: { status, msg: 'Nope' } }, { status }),
      ),
    );
    signInForTest();
    await renderWithProviders(<ForYouRoute />);
    expect(await screen.findByTestId('for-you-unavailable')).toBeTruthy();
    expect(
      screen.getByText("Tumblr doesn't offer this feed to third-party apps right now"),
    ).toBeTruthy();
    const navigate = jest.spyOn(router, 'navigate').mockImplementation(() => undefined);
    await fireEvent.press(screen.getByRole('button', { name: 'Go to Dashboard' }));
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });
});

describe('likes route', () => {
  it('shows an empty hint and the guest notice with no bookmarks', async () => {
    await renderWithProviders(<LikesRoute />);
    expect(screen.getByTestId('likes-guest-hint')).toBeTruthy();
    expect(screen.getByText('Nothing saved yet')).toBeTruthy();
  });

  it('lists local bookmarks for guests', async () => {
    useBookmarksStore.getState().toggle(makeTestItem());
    await renderWithProviders(<LikesRoute />);
    expect(screen.getByTestId('likes-guest-hint')).toBeTruthy();
    expect(screen.queryByText('Nothing saved yet')).toBeNull();
    expect(screen.getAllByTestId('expo-image').length).toBeGreaterThan(0);
  });

  it('shows Tumblr likes without the guest hint when signed in', async () => {
    signInForTest();
    await renderWithProviders(<LikesRoute />);
    expect(screen.queryByTestId('likes-guest-hint')).toBeNull();
    await waitFor(() => expect(screen.getAllByTestId('expo-image').length).toBeGreaterThan(0));
  });
});
