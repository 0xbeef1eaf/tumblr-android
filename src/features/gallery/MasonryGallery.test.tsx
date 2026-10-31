import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Text } from 'react-native';

import { useSettingsStore } from '@/features/settings/settingsStore';

import { makeItem, makeItems } from './items.testutil';
import { MasonryGallery, type MasonryGalleryProps } from './MasonryGallery';
import { useViewerStore } from './viewerStore';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), replace: jest.fn() },
}));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));
jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  Asset: { create: jest.fn(async () => ({})) },
}));
jest.mock('expo-file-system', () => ({ File: class {}, Paths: { cache: 'cache' } }));
// FlashList measures its parent natively; give it a phone-sized viewport (its jestSetup).
jest.mock('@shopify/flash-list/dist/recyclerview/utils/measureLayout', () => {
  const actual = jest.requireActual<Record<string, unknown>>(
    '@shopify/flash-list/dist/recyclerview/utils/measureLayout',
  );
  const box = (width: number, height: number) => () => ({ x: 0, y: 0, width, height });
  return {
    ...actual,
    measureParentSize: jest.fn(box(400, 900)),
    measureFirstChildLayout: jest.fn(box(400, 900)),
    measureItemLayout: jest.fn(box(100, 100)),
  };
});

function props(overrides: Partial<MasonryGalleryProps> = {}): MasonryGalleryProps {
  return {
    items: makeItems(6),
    isLoading: false,
    isFetchingNextPage: false,
    hasNextPage: true,
    onEndReached: jest.fn(),
    onRefresh: jest.fn(),
    isRefetching: false,
    ...overrides,
  };
}

describe('MasonryGallery', () => {
  beforeEach(() => {
    useViewerStore.getState().close();
    useSettingsStore.getState().reset();
    useSettingsStore.getState().setColumns(2);
  });

  it('shows a 12-tile skeleton on first load', async () => {
    await render(<MasonryGallery {...props({ items: [], isLoading: true })} />);
    expect(screen.getAllByTestId('skeleton-tile', { includeHiddenElements: true })).toHaveLength(
      12,
    );
  });

  it('renders tiles and opens the viewer at the tapped index', async () => {
    const p = props();
    await render(<MasonryGallery {...p} />);
    expect(screen.getByTestId('tile-p0:0')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('tile-p2:0'));
    const state = useViewerStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.index).toBe(2);
    expect(state.items).toBe(p.items);
    expect(router.push).toHaveBeenCalledWith('/viewer');

    // The viewer can ask the gallery for more.
    state.onLoadMore?.();
    expect(p.onEndReached).toHaveBeenCalled();
  });

  it('opens the viewer with the filtered list and the filtered index', async () => {
    const items = [
      makeItem({ id: 'a:0' }),
      makeItem({ id: 'b:0', kind: 'gif' }),
      makeItem({ id: 'c:0' }),
      makeItem({ id: 'd:0', kind: 'gif' }),
    ];
    await render(<MasonryGallery {...props({ items, kindFilter: 'gif' })} />);
    expect(screen.queryByTestId('tile-a:0')).toBeNull();
    await fireEvent.press(screen.getByTestId('tile-d:0'));
    const state = useViewerStore.getState();
    expect(state.items.map((i) => i.id)).toEqual(['b:0', 'd:0']);
    expect(state.index).toBe(1);
  });

  it('keeps an open viewer in sync when new pages arrive', async () => {
    const first = makeItems(3);
    const { rerender } = await render(<MasonryGallery {...props({ items: first })} />);
    await fireEvent.press(screen.getByTestId('tile-p1:0'));
    const more = [...first, ...makeItems(2, 'q')];
    await rerender(<MasonryGallery {...props({ items: more })} />);
    expect(useViewerStore.getState().items).toBe(more);
    expect(useViewerStore.getState().index).toBe(1);
  });

  it('shows the empty state and the next-page footer', async () => {
    const { rerender } = await render(
      <MasonryGallery {...props({ items: [], emptyState: <Text>Nothing tagged #x yet</Text> })} />,
    );
    expect(screen.getByText('Nothing tagged #x yet')).toBeTruthy();
    await rerender(<MasonryGallery {...props({ isFetchingNextPage: true })} />);
    expect(
      screen.getByTestId('gallery-footer-skeleton', { includeHiddenElements: true }),
    ).toBeTruthy();
  });

  it('offers quick actions on long press, with Like only when wired', async () => {
    const onLike = jest.fn();
    const p = props();
    const { rerender } = await render(<MasonryGallery {...p} />);
    await fireEvent(screen.getByTestId('tile-p0:0'), 'longPress');
    expect(screen.getByText('Open post')).toBeTruthy();
    expect(screen.queryByText('Like')).toBeNull();

    await fireEvent.press(screen.getByTestId('quick-action-blog'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/blog/[name]',
      params: { name: 'staff' },
    });

    await rerender(<MasonryGallery {...p} onLike={onLike} />);
    await fireEvent(screen.getByTestId('tile-p1:0'), 'longPress');
    await fireEvent.press(screen.getByTestId('quick-action-like'));
    expect(onLike).toHaveBeenCalledWith(p.items[1]);

    await fireEvent(screen.getByTestId('tile-p1:0'), 'longPress');
    await fireEvent.press(screen.getByTestId('quick-action-post'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/post/[blog]/[id]',
      params: { blog: 'staff', id: 'p1' },
    });
  });

  it('requests the next page on end reached only when there is one', async () => {
    const onEndReached = jest.fn();
    const { rerender } = await render(<MasonryGallery {...props({ onEndReached })} />);
    // Short content reaches the end straight away.
    expect(onEndReached).toHaveBeenCalled();
    onEndReached.mockClear();
    await rerender(<MasonryGallery {...props({ onEndReached, hasNextPage: false })} />);
    await act(async () => screen.getByTestId('masonry-gallery-list').props.onEndReached());
    expect(onEndReached).not.toHaveBeenCalled();
  });
});
