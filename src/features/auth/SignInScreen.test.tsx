import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';
import {
  errorEvent,
  httpErrorEvent,
  lastWebViewProps,
  loadRequest,
  navigationEvent,
  webViewMountCount,
} from '@/test/webview';

import { useOAuthFlowStore, type OAuthFlowResult } from './oauthFlowStore';
import { SignInScreen } from './SignInScreen';
import { httpErrorMessage, LOAD_ERROR_MESSAGE, SIGN_IN_TITLE } from './SignInWebView';

const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn(() => true);
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
  useNavigation: () => ({ canGoBack: mockCanGoBack, goBack: mockGoBack }),
}));

const CALLBACK = 'https://0xbeef1eaf.github.io/tumblr-android/auth/callback';
const AUTHORIZE = 'https://www.tumblr.com/oauth2/authorize?client_id=k&state=s1';

/** A pending flow plus a spy on how it settled. */
function pendingFlow() {
  const outcome = jest.fn<void, [OAuthFlowResult | Error]>();
  const result = useOAuthFlowStore
    .getState()
    .begin({ url: AUTHORIZE, state: 's1', redirectUri: CALLBACK });
  void result.then(outcome, outcome);
  return { result, outcome };
}

const flushTimers = () => act(() => new Promise((resolve) => setTimeout(resolve, 5)));

beforeEach(() => mockCanGoBack.mockReturnValue(true));
afterEach(() => useOAuthFlowStore.getState().cancel());

describe('SignInScreen', () => {
  it('loads the authorize URL in a persistent-cookie WebView under a header', async () => {
    pendingFlow();
    await renderWithProviders(<SignInScreen />);
    expect(screen.getByText(SIGN_IN_TITLE)).toBeTruthy();
    expect(screen.getByTestId('sign-in-cancel')).toBeTruthy();
    expect(screen.getByTestId('sign-in-loading')).toBeTruthy();
    const props = lastWebViewProps();
    expect(props.source).toEqual({ uri: AUTHORIZE });
    expect(props.incognito).toBe(false);
    expect(props.sharedCookiesEnabled).toBe(true);
    await act(async () => props.onLoadEnd?.(navigationEvent(AUTHORIZE)));
    expect(screen.queryByTestId('sign-in-loading')).toBeNull();
  });

  it('lets ordinary pages load, including look-alike callback paths', async () => {
    const { outcome } = pendingFlow();
    await renderWithProviders(<SignInScreen />);
    const allow = lastWebViewProps().onShouldStartLoadWithRequest;
    expect(allow?.(loadRequest('https://www.tumblr.com/login'))).toBe(true);
    expect(allow?.(loadRequest(`${CALLBACK}/more?code=x&state=s1`))).toBe(true);
    await flushTimers();
    expect(outcome).not.toHaveBeenCalled();
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('intercepts the callback URL, resolves the code and closes', async () => {
    const { result, outcome } = pendingFlow();
    const { unmount } = await renderWithProviders(<SignInScreen />);
    let allowed: boolean | undefined;
    await act(async () => {
      allowed = lastWebViewProps().onShouldStartLoadWithRequest?.(
        loadRequest(`${CALLBACK}?code=the-code&state=s1`),
      );
    });
    expect(allowed).toBe(false);
    await expect(result).resolves.toEqual({
      status: 'success',
      code: 'the-code',
      redirectUri: CALLBACK,
    });
    expect(mockGoBack).toHaveBeenCalledTimes(1);
    // The dismissal that follows must not turn the success into a cancel.
    await unmount();
    await flushTimers();
    expect(outcome).toHaveBeenCalledTimes(1);
  });

  it('also completes from onLoadStart if the request hook was skipped', async () => {
    const { result } = pendingFlow();
    await renderWithProviders(<SignInScreen />);
    await act(async () =>
      lastWebViewProps().onLoadStart?.(navigationEvent(`${CALLBACK}?code=c&state=s1`)),
    );
    await expect(result).resolves.toMatchObject({ status: 'success', code: 'c' });
  });

  it('rejects a callback with the wrong state', async () => {
    const { result } = pendingFlow();
    await renderWithProviders(<SignInScreen />);
    await act(async () => {
      lastWebViewProps().onShouldStartLoadWithRequest?.(
        loadRequest(`${CALLBACK}?code=x&state=evil`),
      );
    });
    await expect(result).rejects.toMatchObject({ code: 'state_mismatch' });
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('reports access_denied when the user declines on Tumblr', async () => {
    const { result } = pendingFlow();
    await renderWithProviders(<SignInScreen />);
    await act(async () => {
      lastWebViewProps().onShouldStartLoadWithRequest?.(
        loadRequest(`${CALLBACK}?error=access_denied&error_description=Denied&state=s1`),
      );
    });
    await expect(result).rejects.toMatchObject({ code: 'access_denied', message: 'Denied' });
  });

  it('Cancel resolves cancelled and closes', async () => {
    const { result } = pendingFlow();
    await renderWithProviders(<SignInScreen />);
    await fireEvent.press(screen.getByTestId('sign-in-cancel'));
    await expect(result).resolves.toEqual({ status: 'cancelled' });
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('a back gesture (unmount) resolves cancelled', async () => {
    const { result } = pendingFlow();
    const { unmount } = await renderWithProviders(<SignInScreen />);
    await unmount();
    await flushTimers();
    await expect(result).resolves.toEqual({ status: 'cancelled' });
  });

  it('shows a load error with Retry, which reloads the page', async () => {
    const { outcome } = pendingFlow();
    await renderWithProviders(<SignInScreen />);
    await act(async () => lastWebViewProps().onError?.(errorEvent(AUTHORIZE)));
    expect(screen.getByText(LOAD_ERROR_MESSAGE)).toBeTruthy();
    expect(webViewMountCount()).toBe(1);
    await fireEvent.press(screen.getByTestId('sign-in-retry'));
    expect(screen.queryByTestId('sign-in-error')).toBeNull();
    expect(webViewMountCount()).toBe(2);
    expect(outcome).not.toHaveBeenCalled();
  });

  it('shows HTTP errors, except for the never-loaded callback URL', async () => {
    pendingFlow();
    await renderWithProviders(<SignInScreen />);
    await act(async () => lastWebViewProps().onHttpError?.(httpErrorEvent(CALLBACK, 404)));
    expect(screen.queryByTestId('sign-in-error')).toBeNull();
    await act(async () => lastWebViewProps().onHttpError?.(httpErrorEvent(AUTHORIZE, 400)));
    expect(screen.getByText(httpErrorMessage(400))).toBeTruthy();
    expect(screen.getByText(/HTTP 400/)).toBeTruthy();
  });

  it('with no pending flow shows "nothing to sign in" and goes back', async () => {
    await renderWithProviders(<SignInScreen />);
    expect(screen.getByTestId('sign-in-empty')).toBeTruthy();
    expect(screen.getByText('Nothing to sign in to.')).toBeTruthy();
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
  });

  it('goes home when there is no history to go back to', async () => {
    mockCanGoBack.mockReturnValue(false);
    await renderWithProviders(<SignInScreen />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(mockGoBack).not.toHaveBeenCalled();
  });
});
