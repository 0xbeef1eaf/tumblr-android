import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';

import { useSession, type Session } from '@/features/auth';
import { useSearchHistoryStore } from '@/features/search';
import { useToastStore } from '@/ui/primitives';

import { API_DOCS_URL, API_TERMS_URL, SettingsScreen } from './SettingsScreen';
import { useSettingsStore } from './settingsStore';

jest.mock('@/features/auth', () => ({ useSession: jest.fn() }));
jest.mock('@/features/search', () => ({ useSearchHistoryStore: jest.fn() }));
jest.mock('expo-linking', () => ({ openURL: jest.fn(async () => true) }));

const mockedUseSession = jest.mocked(useSession);
const mockedHistoryStore = jest.mocked(useSearchHistoryStore);

const signIn = jest.fn(async () => {});
const signOut = jest.fn(async () => {});
const clearHistory = jest.fn();

function setSession(partial: Partial<Session>) {
  mockedUseSession.mockReturnValue({
    status: 'guest',
    user: null,
    signIn,
    signOut,
    ...partial,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.getState().reset();
  useToastStore.getState().clear();
  setSession({});
  mockedHistoryStore.mockImplementation(((selector: (s: { clear: () => void }) => unknown) =>
    selector({ clear: clearHistory })) as unknown as typeof useSearchHistoryStore);
});

describe('SettingsScreen', () => {
  it('toggles each switch into the settings store', async () => {
    await render(<SettingsScreen />);
    const toggles: [string, keyof ReturnType<typeof useSettingsStore.getState>, boolean][] = [
      ['Show blog name', 'showBlogName', false],
      ['Safe mode', 'safeMode', false],
      ['Autoplay video', 'autoplayVideo', true],
    ];
    for (const [label, key, next] of toggles) {
      await fireEvent(screen.getByLabelText(label), 'valueChange', next);
      expect(useSettingsStore.getState()[key]).toBe(next);
    }
  });

  it('hides the unimplemented "Autoplay GIFs on cellular" row', async () => {
    await render(<SettingsScreen />);
    expect(screen.queryByLabelText('Autoplay GIFs on cellular')).toBeNull();
  });

  it('shows current switch values', async () => {
    useSettingsStore.getState().setSafeMode(false);
    await render(<SettingsScreen />);
    expect(screen.getByLabelText('Safe mode').props.accessibilityState.checked).toBe(false);
    expect(screen.getByLabelText('Show blog name').props.accessibilityState.checked).toBe(true);
  });

  it('changes the column count', async () => {
    useSettingsStore.getState().setColumns(2);
    await render(<SettingsScreen />);
    expect(screen.getByTestId('columns-2').props.accessibilityState.selected).toBe(true);
    await fireEvent.press(screen.getByTestId('columns-3'));
    expect(useSettingsStore.getState().columns).toBe(3);
    expect(screen.getByTestId('columns-3').props.accessibilityState.selected).toBe(true);
    await fireEvent.press(screen.getByTestId('columns-2'));
    expect(useSettingsStore.getState().columns).toBe(2);
  });

  it('clears the image cache after confirmation and shows a toast', async () => {
    await render(<SettingsScreen />);
    await fireEvent.press(screen.getByTestId('row-clear-cache'));
    expect(Image.clearDiskCache).not.toHaveBeenCalled();
    expect(screen.getByText('Clear image cache?')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('confirm-sheet-confirm'));
    expect(Image.clearDiskCache).toHaveBeenCalledTimes(1);
    expect(Image.clearMemoryCache).toHaveBeenCalledTimes(1);
    expect(useToastStore.getState().toasts.at(-1)).toMatchObject({
      message: 'Image cache cleared',
      kind: 'success',
    });
  });

  it('reports an error toast when clearing the cache fails', async () => {
    jest.mocked(Image.clearDiskCache).mockRejectedValueOnce(new Error('boom'));
    await render(<SettingsScreen />);
    await fireEvent.press(screen.getByTestId('row-clear-cache'));
    await fireEvent.press(screen.getByTestId('confirm-sheet-confirm'));
    expect(useToastStore.getState().toasts.at(-1)).toMatchObject({ kind: 'error' });
  });

  it('clears search history after confirmation', async () => {
    await render(<SettingsScreen />);
    await fireEvent.press(screen.getByTestId('row-clear-history'));
    expect(clearHistory).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('confirm-sheet-confirm'));
    expect(clearHistory).toHaveBeenCalledTimes(1);
    expect(useToastStore.getState().toasts.at(-1)?.message).toBe('Search history cleared');
  });

  it('does nothing when the confirmation is cancelled', async () => {
    await render(<SettingsScreen />);
    await fireEvent.press(screen.getByTestId('row-clear-history'));
    await fireEvent.press(screen.getByTestId('confirm-sheet-cancel'));
    expect(clearHistory).not.toHaveBeenCalled();
    expect(Image.clearDiskCache).not.toHaveBeenCalled();
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('offers sign in to guests', async () => {
    await render(<SettingsScreen />);
    expect(screen.queryByTestId('row-sign-out')).toBeNull();
    await fireEvent.press(screen.getByTestId('row-sign-in'));
    expect(signIn).toHaveBeenCalledTimes(1);
  });

  it('disables sign in while the session is loading', async () => {
    setSession({ status: 'loading' });
    await render(<SettingsScreen />);
    await fireEvent.press(screen.getByTestId('row-sign-in'));
    expect(signIn).not.toHaveBeenCalled();
  });

  it('shows the primary blog and signs out', async () => {
    setSession({ status: 'signedIn', user: { name: 'ann', primaryBlog: 'annsblog' } });
    await render(<SettingsScreen />);
    expect(screen.getByText('Signed in as annsblog')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('row-sign-out'));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('falls back to the user name when there is no primary blog', async () => {
    setSession({ status: 'signedIn', user: { name: 'ann' } });
    await render(<SettingsScreen />);
    expect(screen.getByText('Signed in as ann')).toBeTruthy();
  });

  it('shows the version and opens the API links', async () => {
    await render(<SettingsScreen />);
    expect(screen.getByText('Version')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('row-api-terms'));
    expect(Linking.openURL).toHaveBeenLastCalledWith(API_TERMS_URL);
    await fireEvent.press(screen.getByTestId('row-api-docs'));
    expect(Linking.openURL).toHaveBeenLastCalledWith(API_DOCS_URL);
    expect(screen.getByText(/MIT licensed/)).toBeTruthy();
  });

  it('renders every section', async () => {
    await render(<SettingsScreen />);
    await act(async () => {});
    for (const id of ['account', 'grid', 'content', 'storage', 'about']) {
      expect(screen.getByTestId(`section-${id}`)).toBeTruthy();
    }
  });
});
