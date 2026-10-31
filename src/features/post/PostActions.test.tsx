import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Linking from 'expo-linking';
import { Share } from 'react-native';

import { setTokenProvider } from '@/api/client';
import {
  createClient,
  makeTestItem,
  resetAuthState,
  signInForTest,
} from '@/features/auth/auth.testutil';
import { useBookmarksStore } from '@/features/auth';
import { API, server } from '@/test/msw';
import { renderWithProviders } from '@/test/render';
import { useToastStore } from '@/ui/primitives/toastStore';
import { http, HttpResponse } from 'msw';

import { PostActions } from './PostActions';
import { saveMediaToLibrary, SavePermissionError } from './saveMedia';

jest.mock('expo-linking', () => ({ openURL: jest.fn(async () => true) }));
jest.mock('./saveMedia', () => {
  const actual = jest.requireActual<typeof import('./saveMedia')>('./saveMedia');
  return { ...actual, saveMediaToLibrary: jest.fn(async (urls: string[]) => urls.length) };
});

const item = makeTestItem();
const urls = ['https://img/1.jpg', 'https://img/2.jpg'];
const toasts = () => useToastStore.getState().toasts.map((t) => t.message);

let client = createClient();
beforeEach(() => {
  client = createClient();
  resetAuthState();
  useToastStore.getState().clear();
});
afterEach(() => setTokenProvider(null));

describe('PostActions', () => {
  it('guest: Like bookmarks the item locally and Reblog asks to sign in', async () => {
    await renderWithProviders(<PostActions item={item} mediaUrls={urls} />, { client });
    await fireEvent.press(screen.getByRole('button', { name: 'Like' }));
    expect(useBookmarksStore.getState().items).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Unlike' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Reblog' }));
    expect(toasts()).toContain('Sign in to reblog');
    expect(screen.queryByTestId('sheet')).toBeNull();
  });

  it('signed in: Reblog opens the confirm sheet and posts comment + tags', async () => {
    signInForTest('pixelwanderer');
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.post(`${API}/v2/blog/:blog/posts`, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(
          { meta: { status: 201, msg: 'Created' }, response: { state: 'published' } },
          { status: 201 },
        );
      }),
    );
    await renderWithProviders(<PostActions item={item} mediaUrls={urls} />, { client });
    await fireEvent.press(screen.getByRole('button', { name: 'Reblog' }));
    expect(screen.getByText('Reblog to pixelwanderer')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Reblog comment'), 'so good');
    await fireEvent.changeText(screen.getByLabelText('Reblog tags'), 'art, #photo');
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm reblog' }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({
      reblog_key: item.reblogKey,
      content: [{ type: 'text', text: 'so good' }],
      tags: 'art,photo',
    });
    await waitFor(() => expect(toasts()).toContain('Reblogged to pixelwanderer'));
  });

  it('shares the post link and opens it in the browser', async () => {
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    await renderWithProviders(<PostActions item={item} mediaUrls={urls} />, { client });
    await fireEvent.press(screen.getByRole('button', { name: 'Share' }));
    expect(share).toHaveBeenCalledWith({ message: item.postUrl, url: item.postUrl });
    await fireEvent.press(screen.getByRole('button', { name: 'Open' }));
    expect(Linking.openURL).toHaveBeenCalledWith(item.postUrl);
  });

  it('saves all media and reports the count', async () => {
    await renderWithProviders(<PostActions item={item} mediaUrls={urls} />, { client });
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(toasts()).toContain('Saved 2 items to your gallery'));
    expect(saveMediaToLibrary).toHaveBeenCalledWith(urls);
  });

  it('explains a denied storage permission', async () => {
    jest.mocked(saveMediaToLibrary).mockRejectedValueOnce(new SavePermissionError());
    await renderWithProviders(<PostActions item={item} mediaUrls={urls} />, { client });
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(toasts()).toContain('Allow gallery access to save media'));
  });

  it('disables Save when the post has no media', async () => {
    await renderWithProviders(<PostActions item={item} mediaUrls={[]} />, { client });
    expect(screen.getByRole('button', { name: 'Save' }).props.accessibilityState.disabled).toBe(
      true,
    );
  });
});
