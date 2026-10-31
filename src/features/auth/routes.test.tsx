import { screen, waitFor } from '@testing-library/react-native';
import { maybeCompleteAuthSession } from 'expo-web-browser';

import { renderWithProviders } from '@/test/render';

import CallbackRoute from '../../../app/auth/callback';
import PostRoute from '../../../app/post/[blog]/[id]';

const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn(() => false);
jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockReplace,
    back: mockBack,
    canGoBack: mockCanGoBack,
    push: jest.fn(),
  }),
  useLocalSearchParams: () => ({ blog: 'northlight-studio', id: '742388497658807856' }),
}));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }));

describe('auth callback route', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockBack.mockClear();
  });

  it('completes the auth session, shows a spinner and returns home without history', async () => {
    mockCanGoBack.mockReturnValue(false);
    await renderWithProviders(<CallbackRoute />);
    expect(screen.getByTestId('auth-callback')).toBeTruthy();
    expect(screen.getByText('Finishing sign-in…')).toBeTruthy();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(mockBack).not.toHaveBeenCalled();
    expect(maybeCompleteAuthSession).toHaveBeenCalled();
  });

  it('goes back to where sign-in started when there is history', async () => {
    mockCanGoBack.mockReturnValue(true);
    await renderWithProviders(<CallbackRoute />);
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

describe('post route', () => {
  it('renders the post detail for the route params', async () => {
    await renderWithProviders(<PostRoute />);
    expect(await screen.findByTestId('post-detail')).toBeTruthy();
    expect(screen.getByText('northlight-studio')).toBeTruthy();
  });
});
