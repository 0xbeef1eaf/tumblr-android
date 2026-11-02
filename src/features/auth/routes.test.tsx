import { screen, waitFor } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';
import { lastWebViewProps } from '@/test/webview';

import SignInRoute from '../../../app/auth/sign-in';
import PostRoute from '../../../app/post/[blog]/[id]';
import { useOAuthFlowStore } from './oauthFlowStore';

const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn(() => false);
jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
  useRouter: () => ({
    replace: mockReplace,
    back: mockBack,
    canGoBack: mockCanGoBack,
    push: jest.fn(),
  }),
  useNavigation: () => ({ canGoBack: mockCanGoBack, goBack: mockBack }),
  useLocalSearchParams: () => ({ blog: 'northlight-studio', id: '742388497658807856' }),
}));

describe('auth sign-in route', () => {
  afterEach(() => useOAuthFlowStore.getState().cancel());

  it('renders the WebView for a pending flow', async () => {
    const url = 'https://www.tumblr.com/oauth2/authorize?state=s1';
    void useOAuthFlowStore.getState().begin({
      url,
      state: 's1',
      redirectUri: 'https://0xbeef1eaf.github.io/tumblr-android/auth/callback',
    });
    await renderWithProviders(<SignInRoute />);
    expect(screen.getByTestId('sign-in-webview')).toBeTruthy();
    expect(lastWebViewProps().source).toEqual({ uri: url });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('shows "nothing to sign in" and goes home without a pending flow', async () => {
    mockCanGoBack.mockReturnValue(false);
    await renderWithProviders(<SignInRoute />);
    expect(screen.getByTestId('sign-in-empty')).toBeTruthy();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  });
});

describe('post route', () => {
  it('renders the post detail for the route params', async () => {
    await renderWithProviders(<PostRoute />);
    expect(await screen.findByTestId('post-detail')).toBeTruthy();
    expect(screen.getByText('northlight-studio')).toBeTruthy();
  });
});
