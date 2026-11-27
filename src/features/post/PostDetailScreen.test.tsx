import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';

import { resetAuthState } from '@/features/auth/auth.testutil';
import { useViewerStore } from '@/features/gallery';
import { API, MISSING_BLOG, server } from '@/test/msw';
import { renderWithProviders } from '@/test/render';

import { PostDetailScreen } from './PostDetailScreen';
import { FIXTURE_IDS } from './post.testutil';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('expo-linking', () => ({ openURL: jest.fn(async () => true) }));

const BLOG = 'northlight-studio';

beforeEach(() => {
  resetAuthState();
  useViewerStore.getState().close();
});

describe('PostDetailScreen', () => {
  it('renders the fixture post: author, date, media, tags, notes and actions', async () => {
    // Hold the response until the skeleton has been seen: a fast mock answer would otherwise
    // replace it before the assertion runs. Returning nothing falls through to the default
    // fixture handler.
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    // Signed out, the post comes from `/posts?id=` (signed in it would be `/posts/:id`).
    server.use(
      http.get(`${API}/v2/blog/:blog/posts`, async () => {
        await gate;
      }),
    );
    await renderWithProviders(<PostDetailScreen blog={BLOG} id={FIXTURE_IDS.rows} />);
    expect(screen.getByTestId('post-loading')).toBeTruthy();
    release();
    await screen.findByTestId('post-detail');

    expect(screen.getByText(BLOG)).toBeTruthy();
    expect(screen.getByText('1,890 notes')).toBeTruthy();
    expect(screen.getAllByTestId('npf-image')).toHaveLength(4); // truncation is off on detail
    expect(screen.getByTestId('post-actions')).toBeTruthy();
    for (const tag of ['faroe islands', 'travel', 'landscape']) {
      expect(screen.getByRole('button', { name: `Tag ${tag}` })).toBeTruthy();
    }
  });

  it('links tags to /tag/[tag] and the author to the blog', async () => {
    await renderWithProviders(<PostDetailScreen blog={BLOG} id={FIXTURE_IDS.rows} />);
    await screen.findByTestId('post-detail');
    await fireEvent.press(screen.getByRole('button', { name: 'Tag faroe islands' }));
    expect(mockPush).toHaveBeenLastCalledWith('/tag/faroe%20islands');
    await fireEvent.press(screen.getByRole('button', { name: `Open blog ${BLOG}` }));
    expect(mockPush).toHaveBeenLastCalledWith(`/blog/${BLOG}`);
  });

  it('opens the viewer at the tapped image', async () => {
    await renderWithProviders(<PostDetailScreen blog={BLOG} id={FIXTURE_IDS.rows} />);
    await screen.findByTestId('post-detail');
    await fireEvent.press(screen.getAllByRole('image')[2] as never);
    const viewer = useViewerStore.getState();
    expect(viewer.isOpen).toBe(true);
    expect(viewer.index).toBe(2);
    expect(viewer.items).toHaveLength(4);
    expect(mockPush).toHaveBeenLastCalledWith('/viewer');
  });

  it('expands the trail by default when only the trail carries media', async () => {
    await renderWithProviders(<PostDetailScreen blog={BLOG} id={FIXTURE_IDS.trailOnly} />);
    await screen.findByTestId('post-detail');
    expect(screen.getByTestId('trail-section')).toBeTruthy();
    expect(screen.getAllByTestId('trail-item').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('npf-image').length).toBeGreaterThan(0);
  });

  it("links a reblog to the original poster's blog and each trail entry to its blog", async () => {
    await renderWithProviders(<PostDetailScreen blog={BLOG} id={FIXTURE_IDS.trailOnly} />);
    await screen.findByTestId('post-detail');
    await fireEvent.press(
      screen.getByRole('button', { name: "Open original poster's blog alpine-archive" }),
    );
    expect(mockPush).toHaveBeenLastCalledWith('/blog/alpine-archive');
    mockPush.mockClear();
    await fireEvent.press(screen.getByRole('button', { name: 'Open blog alpine-archive' }));
    expect(mockPush).toHaveBeenLastCalledWith('/blog/alpine-archive');
  });

  it('shows no original-poster link on an original post', async () => {
    await renderWithProviders(<PostDetailScreen blog={BLOG} id={FIXTURE_IDS.rows} />);
    await screen.findByTestId('post-detail');
    expect(screen.queryByTestId('original-poster')).toBeNull();
  });

  it('keeps the trail collapsed when the post has its own media', async () => {
    await renderWithProviders(<PostDetailScreen blog={BLOG} id={FIXTURE_IDS.singleImage} />);
    await screen.findByTestId('post-detail');
    expect(screen.queryByTestId('trail-section')).toBeNull();
  });

  it('shows a friendly message for a missing post', async () => {
    await renderWithProviders(<PostDetailScreen blog={MISSING_BLOG} id="1" />);
    expect(await screen.findByText("This post doesn't exist or is private")).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('offers a retry on other failures', async () => {
    server.use(
      http.get(`${API}/v2/blog/:blog/posts`, () =>
        HttpResponse.json({ meta: { status: 500, msg: 'Server Error' } }, { status: 500 }),
      ),
    );
    await renderWithProviders(<PostDetailScreen blog={BLOG} id="1" />);
    expect(await screen.findByText("Couldn't load this post")).toBeTruthy();
    server.resetHandlers();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.queryByTestId('post-error')).toBeNull());
  });
});
