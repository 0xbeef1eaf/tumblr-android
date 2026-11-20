import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { palettes } from '@/ui/theme';

import { GalleryTile, SAFE_BLUR_RADIUS, type GalleryTileProps } from './GalleryTile';
import { makeItem } from './items.testutil';
import { useRevealStore } from './revealStore';

function props(overrides: Partial<GalleryTileProps> = {}): GalleryTileProps {
  return {
    item: makeItem({ id: '1:0' }),
    index: 3,
    columnWidthPx: 380,
    showBlogName: true,
    safeMode: true,
    animateGifs: false,
    onPress: jest.fn(),
    ...overrides,
  };
}

describe('GalleryTile', () => {
  beforeEach(() => useRevealStore.getState().reset());

  it('renders the picked variant with caching, recycling and placeholder colour', async () => {
    const item = makeItem({ id: '1:0', placeholderColor: '#336699', aspectRatio: 0.2 });
    await render(<GalleryTile {...props({ item })} />);
    const image = screen.getByTestId('tile-image-1:0');
    expect(image.props.source.uri).toContain('s400x600');
    expect(image.props).toMatchObject({
      recyclingKey: '1:0',
      cachePolicy: 'memory-disk',
      transition: 200,
      autoplay: false,
    });
    expect(image.props.blurRadius).toBeUndefined();
    const tile = screen.getByRole('button', { name: 'Image from staff' });
    expect(StyleSheet.flatten(tile.props.style)).toMatchObject({
      backgroundColor: '#336699',
      aspectRatio: 0.5,
    });
  });

  it('falls back to the surface colour and uses alt text as the label', async () => {
    const item = makeItem({ id: '1:0', altText: 'A red fox' });
    await render(<GalleryTile {...props({ item })} />);
    const tile = screen.getByRole('button', { name: 'A red fox' });
    expect([palettes.dark.surface, palettes.light.surface]).toContain(
      StyleSheet.flatten(tile.props.style).backgroundColor,
    );
  });

  it('shows GIF, video and photoset badges', async () => {
    const gif = makeItem({
      id: 'g:1',
      kind: 'gif',
      indexInPost: 1,
      countInPost: 3,
      variants: [{ url: 'https://64.media.tumblr.com/g/s400x400/a.gif', width: 400, height: 400 }],
    });
    const { rerender } = await render(<GalleryTile {...props({ item: gif, animateGifs: true })} />);
    expect(screen.getByText('GIF')).toBeTruthy();
    expect(screen.getByText('2/3')).toBeTruthy();
    expect(screen.getByTestId('tile-image-g:1').props.autoplay).toBe(true);

    const video = makeItem({ id: 'v:0', kind: 'video', durationMs: 12_000 });
    await rerender(<GalleryTile {...props({ item: video })} />);
    expect(screen.getByText('▶ 0:12')).toBeTruthy();
  });

  it('shows the poster still for a GIF that may not animate, the GIF when it may', async () => {
    const gifItem = makeItem({
      id: 'g:0',
      kind: 'gif',
      posterUrl: 'https://64.media.tumblr.com/g/s540x540/still.jpg',
      variants: [
        { url: 'https://64.media.tumblr.com/g/s540x540/a.gif', width: 540, height: 540 },
        { url: 'https://64.media.tumblr.com/g/s250x250/a.gif', width: 250, height: 250 },
      ],
    });
    const { rerender } = await render(<GalleryTile {...props({ item: gifItem })} />);
    const still = screen.getByTestId('tile-image-g:0');
    expect(still.props.source.uri).toBe(gifItem.posterUrl);
    expect(still.props.autoplay).toBe(false);

    await rerender(<GalleryTile {...props({ item: gifItem, animateGifs: true })} />);
    const playing = screen.getByTestId('tile-image-g:0');
    expect(playing.props.source.uri).toBe('https://64.media.tumblr.com/g/s540x540/a.gif');
    expect(playing.props.autoplay).toBe(true);
    // A new key remounts the native view so the animation starts.
    expect(playing).not.toBe(still);

    // Without a poster the paused GIF itself is the still.
    const noPoster = { ...gifItem, posterUrl: undefined };
    await rerender(<GalleryTile {...props({ item: noPoster })} />);
    expect(screen.getByTestId('tile-image-g:0').props).toMatchObject({
      source: { uri: 'https://64.media.tumblr.com/g/s540x540/a.gif' },
      autoplay: false,
    });
  });

  it('keeps the same image view for a non-GIF across re-renders', async () => {
    const { rerender } = await render(<GalleryTile {...props()} />);
    const before = screen.getByTestId('tile-image-1:0');
    await rerender(<GalleryTile {...props({ animateGifs: true })} />);
    expect(screen.getByTestId('tile-image-1:0')).toBe(before);
  });

  it('shows the blog overlay only when enabled', async () => {
    const { rerender } = await render(<GalleryTile {...props()} />);
    expect(screen.getByText('staff')).toBeTruthy();
    await rerender(<GalleryTile {...props({ showBlogName: false })} />);
    expect(screen.queryByText('staff')).toBeNull();
  });

  it('opens with the item and index on press', async () => {
    const onPress = jest.fn();
    const onLongPress = jest.fn();
    const p = props({ onPress, onLongPress });
    await render(<GalleryTile {...p} />);
    await fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledWith(p.item, 3);
    await fireEvent(screen.getByRole('button'), 'longPress');
    expect(onLongPress).toHaveBeenCalledWith(p.item, 3);
  });

  it('blurs sensitive items under safe mode and reveals them for the session on tap', async () => {
    const onPress = jest.fn();
    const item = makeItem({ id: '9:0', isSensitive: true });
    await render(<GalleryTile {...props({ item, onPress })} />);
    expect(screen.getByText('Sensitive')).toBeTruthy();
    expect(screen.getByTestId('tile-image-9:0').props.blurRadius).toBe(SAFE_BLUR_RADIUS);

    await fireEvent.press(screen.getByRole('button', { name: /Sensitive content/ }));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.queryByText('Sensitive')).toBeNull();
    expect(screen.getByTestId('tile-image-9:0').props.blurRadius).toBeUndefined();
    expect(useRevealStore.getState().revealed.has('9')).toBe(true);

    await fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalled();
  });

  it('does not blur when safe mode is off', async () => {
    const item = makeItem({ id: '9:0', isSensitive: true });
    await render(<GalleryTile {...props({ item, safeMode: false })} />);
    expect(screen.queryByText('Sensitive')).toBeNull();
  });
});
