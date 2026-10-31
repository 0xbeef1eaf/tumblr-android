import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';

import { SearchScreen, searchMode } from './SearchScreen';
import { useSearchHistoryStore } from './searchHistoryStore';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: mockPush, setParams: jest.fn() }),
}));
jest.mock(
  '@/features/gallery',
  () => jest.requireActual('@/features/tag/galleryMock.testutil').galleryMock,
);
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(() => Promise.resolve()) }));

const type = (text: string) => fireEvent.changeText(screen.getByTestId('search-input'), text);
const history = () => useSearchHistoryStore.getState().entries.map((e) => `${e.type}:${e.value}`);

beforeEach(() => useSearchHistoryStore.getState().clear());

describe('searchMode', () => {
  it.each([
    ['', null, 'idle'],
    ['  ', null, 'idle'],
    ['cats', null, 'typing'],
    ['cats', 'cats', 'results'],
    ['', 'cats', 'idle'],
  ] as const)('text %j, submitted %j → %s', (text, submitted, expected) => {
    expect(searchMode(text, submitted)).toBe(expected);
  });
});

describe('SearchScreen', () => {
  it('starts idle with the hint and no recents', async () => {
    await renderWithProviders(<SearchScreen />);
    expect(screen.getByTestId('search-idle')).toBeTruthy();
    expect(screen.getByText('Search tags and blogs')).toBeTruthy();
    expect(screen.queryByText('Recent')).toBeNull();
  });

  it('lists, opens, removes and clears recents while idle', async () => {
    useSearchHistoryStore.getState().add('tag', 'space');
    useSearchHistoryStore.getState().add('blog', 'staff');
    await renderWithProviders(<SearchScreen />);
    expect(screen.getByText('Recent')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Remove #space'));
    expect(history()).toEqual(['blog:staff']);

    await fireEvent.press(screen.getByLabelText('staff.tumblr.com'));
    expect(mockPush).toHaveBeenCalledWith('/blog/staff');

    await fireEvent.press(screen.getByLabelText('Clear recent searches'));
    expect(history()).toEqual([]);
  });

  it('shows tag and blog suggestions after the debounce', async () => {
    await renderWithProviders(<SearchScreen />);
    await type('cats');
    expect(screen.queryByText('Tag: #cats')).toBeNull();
    expect(await screen.findByText('Tag: #cats')).toBeTruthy();
    expect(screen.getByText('Blog: cats.tumblr.com')).toBeTruthy();
    expect(screen.queryByTestId('search-results')).toBeNull();
  });

  it('shows results for a picked tag, records it, and filters by kind', async () => {
    await renderWithProviders(<SearchScreen />);
    await type('cats');
    await fireEvent.press(await screen.findByLabelText('Tag: #cats'));

    expect(await screen.findByTestId('search-results')).toBeTruthy();
    expect(history()).toEqual(['tag:cats']);
    await waitFor(() =>
      expect(Number(screen.getByTestId('masonry-count').props.children)).toBeGreaterThan(0),
    );
    expect(screen.getByTestId('masonry-kind').props.children).toBe('all');

    await fireEvent.press(screen.getByLabelText('GIFs'));
    expect(screen.getByTestId('masonry-kind').props.children).toBe('gif');
  });

  it('submitting from the keyboard searches the tag', async () => {
    await renderWithProviders(<SearchScreen />);
    await type('#Street Photo');
    await fireEvent(screen.getByTestId('search-input'), 'submitEditing');
    expect(await screen.findByTestId('search-results')).toBeTruthy();
    expect(history()).toEqual(['tag:Street Photo']);
    expect(screen.getByTestId('search-input').props.value).toBe('Street Photo');
  });

  it('navigates to the blog for a blog suggestion', async () => {
    await renderWithProviders(<SearchScreen />);
    await type('staff');
    await fireEvent.press(await screen.findByLabelText('Blog: staff.tumblr.com'));
    expect(mockPush).toHaveBeenCalledWith('/blog/staff');
    expect(history()).toEqual(['blog:staff']);
    expect(screen.queryByTestId('search-results')).toBeNull();
  });

  it('offers matching recents among the suggestions and can remove them', async () => {
    useSearchHistoryStore.getState().add('tag', 'catsuit');
    await renderWithProviders(<SearchScreen />);
    await type('cat');
    await fireEvent.press(await screen.findByLabelText('#catsuit'));
    expect(await screen.findByTestId('search-results')).toBeTruthy();
  });

  it('returns to suggestions when the text is edited after a search', async () => {
    await renderWithProviders(<SearchScreen />);
    await type('cats');
    await fireEvent.press(await screen.findByLabelText('Tag: #cats'));
    await screen.findByTestId('search-results');

    await type('cats and dogs');
    await waitFor(() => expect(screen.queryByTestId('search-results')).toBeNull());
    expect(await screen.findByText('Tag: #cats and dogs')).toBeTruthy();
  });

  it('clearing the field goes back to idle', async () => {
    await renderWithProviders(<SearchScreen />);
    await type('cats');
    await fireEvent.press(await screen.findByLabelText('Tag: #cats'));
    await screen.findByTestId('search-results');
    await fireEvent.press(screen.getByTestId('search-clear'));
    expect(screen.getByTestId('search-idle')).toBeTruthy();
    expect(screen.queryByTestId('search-results')).toBeNull();
  });
});
