import { screen, waitFor } from '@testing-library/react-native';
import { maybeCompleteAuthSession } from 'expo-web-browser';

import { renderWithProviders } from '@/test/render';

import CallbackRoute from '../../../app/auth/callback';
import PostRoute from '../../../app/post/[blog]/[id]';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  useLocalSearchParams: () => ({ blog: 'northlight-studio', id: '742388497658807856' }),
}));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }));

describe('auth callback route', () => {
  it('completes the auth session, shows a spinner and returns home', async () => {
    await renderWithProviders(<CallbackRoute />);
    expect(screen.getByTestId('auth-callback')).toBeTruthy();
    expect(screen.getByText('Finishing sign-in…')).toBeTruthy();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(maybeCompleteAuthSession).toHaveBeenCalled();
  });
});

describe('post route', () => {
  it('renders the post detail for the route params', async () => {
    await renderWithProviders(<PostRoute />);
    expect(await screen.findByTestId('post-detail')).toBeTruthy();
    expect(screen.getByText('northlight-studio')).toBeTruthy();
  });
});
