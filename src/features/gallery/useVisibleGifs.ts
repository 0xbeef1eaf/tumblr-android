import type { FlashListProps, ViewToken } from '@shopify/flash-list';
import { useCallback, useState } from 'react';

import type { GalleryItem } from '@/domain/galleryItem';

import { pickAnimatingGifs } from './layout';

type ViewabilityConfig = NonNullable<FlashListProps<GalleryItem>['viewabilityConfig']>;

export const GIF_VIEWABILITY: ViewabilityConfig = { itemVisiblePercentThreshold: 30 };

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}

/**
 * Tracks which visible GIFs may animate (≤ 6, ARCHITECTURE §8). Feed `onViewableItemsChanged`
 * to FlashList; off-screen tiles get `autoplay={false}`.
 */
export function useVisibleGifs() {
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
  return { animating, onViewableItemsChanged };
}
