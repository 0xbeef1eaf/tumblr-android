import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';

import { credentialsStore } from '@/api/credentials';
import { useSession, type Session } from '@/features/auth';
import { useCredentialsStore } from '@/features/credentials';
import { createTestQueryClient, renderWithProviders } from '@/test/render';
import { useToastStore } from '@/ui/primitives';

import { CREDENTIAL_SCOPED_QUERY_ROOTS } from './useCredentialActions';
import { maskKey, STEPS, TUMBLR_APPS_URL, TumblrApiSection } from './TumblrApiSection';

jest.mock('@/features/auth', () => ({ useSession: jest.fn() }));
jest.mock('expo-linking', () => ({ openURL: jest.fn(async () => true) }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));

const signOut = jest.fn(async () => {});

beforeEach(() => {
  useToastStore.getState().clear();
  jest.mocked(useSession).mockReturnValue({
    status: 'signedIn',
    user: { name: 'ann' },
    signIn: jest.fn(async () => {}),
    signOut,
  } satisfies Session);
});

/** A client holding one query per credential-scoped root, plus one that must survive. */
function seededClient() {
  const client = createTestQueryClient();
  for (const root of [...CREDENTIAL_SCOPED_QUERY_ROOTS, 'search']) {
    client.setQueryData([root, 'x'], { root });
  }
  return client;
}

const roots = (client: ReturnType<typeof createTestQueryClient>) =>
  client
    .getQueryCache()
    .getAll()
    .map((q) => q.queryKey[0]);

describe('TumblrApiSection', () => {
  it('shows the status for each credential source', async () => {
    await renderWithProviders(<TumblrApiSection />);
    expect(screen.getByText('Using your credentials')).toBeTruthy();
    expect(screen.getByText('Not set: needed to sign in')).toBeTruthy();

    await act(() => credentialsStore.clear());
    expect(screen.getByText('Not configured')).toBeTruthy();
    expect(screen.queryByTestId('row-remove-credentials')).toBeNull();
    expect(useCredentialsStore.getState()).toMatchObject({ source: 'none', hasApiKey: false });
  });

  it('saves trimmed credentials, signs out and drops cached pages', async () => {
    await credentialsStore.clear();
    const client = seededClient();
    await renderWithProviders(<TumblrApiSection />, { client });
    await fireEvent.press(screen.getByTestId('row-consumer-key'));
    await fireEvent.changeText(screen.getByTestId('input-consumer-key'), '  my-consumer-key-123  ');
    await fireEvent.changeText(screen.getByTestId('input-consumer-secret'), ' shh ');
    expect(screen.getByTestId('input-consumer-secret').props.secureTextEntry).toBe(true);
    await fireEvent.press(screen.getByLabelText('Show secret'));
    expect(screen.getByTestId('input-consumer-secret').props.secureTextEntry).toBe(false);
    await fireEvent.press(screen.getByTestId('credentials-save'));

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(credentialsStore.get()).toEqual({
      consumerKey: 'my-consumer-key-123',
      consumerSecret: 'shh',
    });
    expect(useCredentialsStore.getState().source).toBe('user');
    expect(roots(client)).toEqual(['search']);
    expect(screen.getByText('Using your credentials')).toBeTruthy();
    expect(screen.getByText(maskKey('my-consumer-key-123'))).toBeTruthy();
    expect(screen.getByText('Saved on this device')).toBeTruthy();
    expect(useToastStore.getState().toasts.at(-1)?.message).toBe('Credentials saved');
  });

  it('requires a non-empty consumer key', async () => {
    await renderWithProviders(<TumblrApiSection />);
    await fireEvent.press(screen.getByTestId('row-consumer-secret'));
    await fireEvent.changeText(screen.getByTestId('input-consumer-key'), '   ');
    await fireEvent.press(screen.getByTestId('credentials-save'));
    expect(screen.getByTestId('credentials-error')).toBeTruthy();
    expect(signOut).not.toHaveBeenCalled();
    expect(credentialsStore.get()).toEqual({ consumerKey: 'test' });
  });

  it('does not sign out when the same credentials are saved again', async () => {
    await renderWithProviders(<TumblrApiSection />);
    await fireEvent.press(screen.getByTestId('row-consumer-key'));
    expect(screen.getByTestId('input-consumer-key').props.value).toBe('test');
    await fireEvent.press(screen.getByTestId('credentials-save'));
    expect(signOut).not.toHaveBeenCalled();
  });

  it('removes credentials after confirmation and signs out', async () => {
    const client = seededClient();
    await renderWithProviders(<TumblrApiSection />, { client });
    await fireEvent.press(screen.getByTestId('row-remove-credentials'));
    expect(screen.getByText('Remove your credentials?')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('confirm-remove-credentials-cancel'));
    expect(credentialsStore.get()).not.toBeNull();

    await fireEvent.press(screen.getByTestId('row-remove-credentials'));
    await fireEvent.press(screen.getByTestId('confirm-remove-credentials-confirm'));
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(credentialsStore.get()).toBeNull();
    expect(roots(client)).toEqual(['search']);
    expect(screen.getByText('Not configured')).toBeTruthy();
  });

  it('copies the callback URL and opens the Tumblr apps page', async () => {
    await renderWithProviders(<TumblrApiSection />);
    const callback = 'https://0xbeef1eaf.github.io/tumblr-android/auth/callback';
    expect(screen.getByText(callback)).toBeTruthy();
    expect(screen.getByText(/1\. Open the Tumblr apps page/)).toBeTruthy();
    expect(screen.getByText(/https:\/\/github\.com\/0xbeef1eaf\/tumblr-android/)).toBeTruthy();
    expect(screen.getByText(/“Default callback URL”/)).toBeTruthy();
    expect(STEPS).toHaveLength(4);
    await fireEvent.press(screen.getByTestId('row-callback-url'));
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(callback);
    expect(useToastStore.getState().toasts.at(-1)?.message).toBe('Callback URL copied');
    await fireEvent.press(screen.getByTestId('row-tumblr-apps'));
    expect(Linking.openURL).toHaveBeenCalledWith(TUMBLR_APPS_URL);
  });

  it('masks long keys only', () => {
    expect(maskKey('short')).toBe('short');
    expect(maskKey('abcdefghijklmnop')).toBe('abcd…mnop');
  });
});
