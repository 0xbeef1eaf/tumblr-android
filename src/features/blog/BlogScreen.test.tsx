import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { MISSING_BLOG } from '@/test/msw';
import { renderWithProviders } from '@/test/render';

import { BlogScreen } from './BlogScreen';

const mockSetParams = jest.fn();
const mockToggle = jest.fn();
const mockAuth: {
  status: 'guest' | 'signedIn';
  useFollow?: (name: string) => { isFollowing: boolean; toggle: () => void; isPending: boolean };
} = { status: 'guest' };

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: jest.fn(), setParams: mockSetParams }),
}));
jest.mock(
  '@/features/gallery',
  () => jest.requireActual('@/features/tag/galleryMock.testutil').galleryMock,
);
jest.mock('@/features/auth', () => ({
  useToggleLike: () => jest.fn(),
  useIsLiked: () => () => false,
  __esModule: true,
  useSession: () => ({ status: mockAuth.status }),
  get useFollow() {
    return mockAuth.useFollow;
  },
}));

beforeEach(() => {
  mockAuth.status = 'guest';
  mockAuth.useFollow = undefined;
});

describe('BlogScreen', () => {
  it('shows the not-found state for a missing blog', async () => {
    await renderWithProviders(<BlogScreen name={MISSING_BLOG} />);
    expect(await screen.findByText("This blog doesn't exist or is private")).toBeTruthy();
    expect(screen.queryByTestId('masonry')).toBeNull();
  });

  it('renders header, tag chips and the gallery for a blog', async () => {
    await renderWithProviders(<BlogScreen name="northlight-studio" />);
    expect(await screen.findByText('Northlight Studio')).toBeTruthy();
    expect(screen.getByText('Landscape & travel photography by A. Rivera.')).toBeTruthy();
    expect(screen.getByText('1.8K posts')).toBeTruthy();
    await waitFor(() =>
      expect(Number(screen.getByTestId('masonry-count').props.children)).toBeGreaterThan(0),
    );
    expect(screen.getByTestId('tag-chips')).toBeTruthy();
  });

  it('sets ?tag= when a chip is pressed and clears it when pressed again', async () => {
    const first = await renderWithProviders(<BlogScreen name="northlight-studio" />);
    await waitFor(() => expect(screen.getByTestId('tag-chips')).toBeTruthy());
    const chip = screen.getAllByText(/^#/)[0];
    if (!chip) throw new Error('no chip');
    const label = String(chip.props.children).slice(1);
    await fireEvent.press(chip);
    expect(mockSetParams).toHaveBeenCalledWith({ tag: label });
    await first.unmount();

    await renderWithProviders(<BlogScreen name="northlight-studio" tag={label} />);
    await waitFor(() => expect(screen.getByTestId('tag-chips')).toBeTruthy());
    await fireEvent.press(screen.getByText(`#${label}`));
    expect(mockSetParams).toHaveBeenLastCalledWith({ tag: undefined });
  });

  it('hides Follow for guests', async () => {
    mockAuth.useFollow = () => ({ isFollowing: false, toggle: mockToggle, isPending: false });
    await renderWithProviders(<BlogScreen name="northlight-studio" />);
    await screen.findByText('Northlight Studio');
    expect(screen.queryByTestId('follow-button')).toBeNull();
  });

  it('hides Follow when signed in but useFollow is not exported', async () => {
    mockAuth.status = 'signedIn';
    await renderWithProviders(<BlogScreen name="northlight-studio" />);
    await screen.findByText('Northlight Studio');
    expect(screen.queryByTestId('follow-button')).toBeNull();
  });

  it('shows a working Follow button when signed in and useFollow exists', async () => {
    mockAuth.status = 'signedIn';
    mockAuth.useFollow = () => ({ isFollowing: false, toggle: mockToggle, isPending: false });
    await renderWithProviders(<BlogScreen name="northlight-studio" />);
    const button = await screen.findByTestId('follow-button');
    expect(screen.getByText('Follow')).toBeTruthy();
    await fireEvent.press(button);
    expect(mockToggle).toHaveBeenCalledTimes(1);
  });

  it('labels an already-followed blog "Following"', async () => {
    mockAuth.status = 'signedIn';
    mockAuth.useFollow = () => ({ isFollowing: true, toggle: mockToggle, isPending: false });
    await renderWithProviders(<BlogScreen name="northlight-studio" />);
    expect(await screen.findByText('Following')).toBeTruthy();
  });
});
