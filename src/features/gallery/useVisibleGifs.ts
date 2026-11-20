import type { FlashListProps, ViewToken } from '@shopify/flash-list';
import { useCallback, useState } from 'react';

import type { GalleryItem } from '@/domain/galleryItem';
import { useSetting } from '@/features/settings/settingsStore';
import { useNetworkState } from '@/lib/network';

import { pickAnimatingGifs } from './layout';

type ViewabilityConfig = NonNullable<FlashListProps<GalleryItem>['viewabilityConfig']>;

export const GIF_VIEWABILITY: ViewabilityConfig = { itemVisiblePercentThreshold: 30 };

const NO_GIFS: ReadonlySet<string> = new Set();

/** Settings → "Autoplay GIFs on cellular" (DESIGN §3.8): off means stills only on mobile data. */
export function gifAutoplayAllowed(isCellular: boolean, autoplayOnCellular: boolean): boolean {
  return !isCellular || autoplayOnCellular;
}

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}

/**
 * Tracks which visible GIFs may animate (≤ MAX_ANIMATING_GIFS = 10, ARCHITECTURE §8). Feed
 * `onViewableItemsChanged` to FlashList; every other GIF tile shows a still (poster or paused
 * GIF). On cellular with the autoplay setting off nothing animates: tiles show the still plus
 * the GIF badge, the viewer still plays.
 */
export function useVisibleGifs() {
  const { isCellular } = useNetworkState();
  const autoplayOnCellular = useSetting('autoplayGifsOnCellular');
  const allowed = gifAutoplayAllowed(isCellular, autoplayOnCellular);
  const [animating, setAnimating] = useState<ReadonlySet<string>>(() => new Set());
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<GalleryItem>[] }) => {
      const visible = viewableItems.flatMap((token) =>
        token.isViewable && token.item ? [token.item] : [],
      );
      const next = pickAnimatingGifs(visible);
      setAnimating((prev) => (sameSet(prev, next) ? prev : next));
    },
    [],
  );
  return { animating: allowed ? animating : NO_GIFS, onViewableItemsChanged };
}
