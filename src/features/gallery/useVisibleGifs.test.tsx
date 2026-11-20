import type { ViewToken } from '@shopify/flash-list';
import { act, render, screen } from '@testing-library/react-native';
import { useEffect } from 'react';

import type { GalleryItem } from '@/domain/galleryItem';
import { useSettingsStore } from '@/features/settings/settingsStore';
import { setMockNetworkState, type NetworkPreset } from '@/test/network';

import { GalleryTile } from './GalleryTile';
import { makeGif } from './items.testutil';
import { gifAutoplayAllowed, useVisibleGifs } from './useVisibleGifs';

const gif = makeGif({ id: 'g:0' });

function token(item: GalleryItem, index: number): ViewToken<GalleryItem> {
  return { item, key: item.id, index, isViewable: true, timestamp: 0 };
}

/** A one-tile gallery: the hook decides `animateGifs` exactly as MasonryGallery does. */
function Harness({ item }: { item: GalleryItem }) {
  const { animating, onViewableItemsChanged } = useVisibleGifs();
  useEffect(() => {
    onViewableItemsChanged({ viewableItems: [token(item, 0)] });
  }, [item, onViewableItemsChanged]);
  return (
    <GalleryTile
      item={item}
      index={0}
      columnWidthPx={380}
      showBlogName={false}
      safeMode={false}
      animateGifs={animating.has(item.id)}
      onPress={jest.fn()}
    />
  );
}

const autoplay = () => screen.getByTestId('tile-image-g:0').props.autoplay as boolean;

describe('gifAutoplayAllowed', () => {
  it.each([
    [false, false, true],
    [false, true, true],
    [true, true, true],
    [true, false, false],
  ])('cellular %s, setting %s → %s', (isCellular, setting, expected) => {
    expect(gifAutoplayAllowed(isCellular, setting)).toBe(expected);
  });
});

describe('useVisibleGifs + GalleryTile', () => {
  beforeEach(() => useSettingsStore.getState().reset());

  async function renderOn(network: NetworkPreset, autoplayOnCellular: boolean) {
    useSettingsStore.getState().setAutoplayGifsOnCellular(autoplayOnCellular);
    await act(async () => setMockNetworkState(network));
    await render(<Harness item={gif} />);
  }

  it('animates visible GIFs on Wi-Fi even with the cellular setting off', async () => {
    await renderOn('wifi', false);
    expect(autoplay()).toBe(true);
  });

  it('animates on cellular when "Autoplay GIFs on cellular" is on', async () => {
    await renderOn('cellular', true);
    expect(autoplay()).toBe(true);
  });

  it('shows the first frame and the GIF badge on cellular with the setting off', async () => {
    await renderOn('cellular', false);
    expect(autoplay()).toBe(false);
    expect(screen.getByTestId('badge-gif')).toBeTruthy();
  });

  it('follows network and setting changes while mounted', async () => {
    await renderOn('wifi', false);
    await act(async () => setMockNetworkState('cellular'));
    expect(autoplay()).toBe(false);
    await act(async () => useSettingsStore.getState().setAutoplayGifsOnCellular(true));
    expect(autoplay()).toBe(true);
  });
});
