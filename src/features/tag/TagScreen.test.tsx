import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { Share } from 'react-native';

import { credentialsStore } from '@/api/credentials';
import { errorHandlers, server } from '@/test/msw';
import { renderWithProviders } from '@/test/render';

import { TagScreen, tagShareUrl } from './TagScreen';

const mockPush = jest.fn();
const mockScreenOptions: { current?: { title?: string; headerRight?: () => React.ReactNode } } = {};

jest.mock('expo-router', () => ({
  Stack: {
    Screen: ({
      options,
    }: {
      options?: { title?: string; headerRight?: () => React.ReactNode };
    }) => {
      mockScreenOptions.current = options;
      return options?.headerRight ? options.headerRight() : null;
    },
  },
  useRouter: () => ({ push: mockPush, setParams: jest.fn() }),
}));
jest.mock('@/features/gallery', () => jest.requireActual('./galleryMock.testutil').galleryMock);
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(() => Promise.resolve()) }));

describe('TagScreen', () => {
  it('titles the screen #tag and renders the gallery', async () => {
    await renderWithProviders(<TagScreen tag="photography" />);
    expect(mockScreenOptions.current?.title).toBe('#photography');
    await waitFor(() =>
      expect(Number(screen.getByTestId('masonry-count').props.children)).toBeGreaterThan(0),
    );
  });

  it('cleans the tag from the route param', async () => {
    await renderWithProviders(<TagScreen tag="##Street Photo " />);
    expect(mockScreenOptions.current?.title).toBe('#Street Photo');
  });

  it('passes the kind filter to the gallery', async () => {
    await renderWithProviders(<TagScreen tag="photography" />);
    expect(screen.getByTestId('masonry-kind').props.children).toBe('all');
    await fireEvent.press(screen.getByLabelText('Video'));
    expect(screen.getByTestId('masonry-kind').props.children).toBe('video');
  });

  it('shares the tumblr tag URL', async () => {
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: Share.dismissedAction, activityType: undefined });
    await renderWithProviders(<TagScreen tag="street photo" />);
    await fireEvent.press(screen.getByLabelText('Share tag'));
    expect(share).toHaveBeenCalledWith({
      message: 'https://www.tumblr.com/tagged/street%20photo',
      url: 'https://www.tumblr.com/tagged/street%20photo',
    });
    expect(tagShareUrl('a b')).toBe('https://www.tumblr.com/tagged/a%20b');
  });

  it('shows the empty state with suggestions that navigate', async () => {
    server.use(
      http.get('https://api.tumblr.com/v2/tagged', () =>
        HttpResponse.json({ meta: { status: 200, msg: 'OK' }, response: [] }),
      ),
    );
    await renderWithProviders(<TagScreen tag="zzzz" />);
    expect(await screen.findByText('Nothing tagged #zzzz yet')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('#photography'));
    expect(mockPush).toHaveBeenCalledWith('/tag/photography');
  });

  it('shows an error state with retry when loading fails', async () => {
    server.use(errorHandlers.notFound('/v2/tagged'));
    await renderWithProviders(<TagScreen tag="photography" />);
    expect(await screen.findByTestId('tag-error')).toBeTruthy();
    expect(screen.getByLabelText('Retry')).toBeTruthy();
  });

  it('shows the Connect card as the empty state and fires no request without a key', async () => {
    const requests: string[] = [];
    server.use(
      http.get('https://api.tumblr.com/v2/tagged', ({ request }) => {
        requests.push(request.url);
        return HttpResponse.json({ meta: { status: 200, msg: 'OK' }, response: [] });
      }),
    );
    await credentialsStore.clear();
    await renderWithProviders(<TagScreen tag="photography" />);
    expect(screen.getByTestId('connect-app')).toBeTruthy();
    expect(screen.getByText('Connect your Tumblr app')).toBeTruthy();
    expect(screen.queryByTestId('tag-error')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Open Settings'));
    expect(mockPush).toHaveBeenCalledWith('/settings');
    expect(requests).toHaveLength(0);
  });
});
