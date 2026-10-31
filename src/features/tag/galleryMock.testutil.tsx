import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import type { GalleryItem } from '@/domain/galleryItem';
import { useGalleryPaging } from '@/features/gallery/useGalleryPaging';

interface MasonryGalleryStubProps {
  items: GalleryItem[];
  isLoading: boolean;
  header?: ReactNode;
  emptyState?: ReactNode;
  kindFilter?: string;
  onEndReached: () => void;
}

/** Test stand-in for WP2's MasonryGallery: exposes the props the screens pass in. */
function MasonryGallery({
  items,
  isLoading,
  header,
  emptyState,
  kindFilter,
}: MasonryGalleryStubProps) {
  return (
    <View testID="masonry">
      {header}
      <Text testID="masonry-count">{String(items.length)}</Text>
      <Text testID="masonry-kind">{kindFilter ?? 'unset'}</Text>
      {isLoading ? <Text>loading</Text> : null}
      {!isLoading && items.length === 0 ? emptyState : null}
    </View>
  );
}

/** Use as `jest.mock('@/features/gallery', () => require('@/features/tag/galleryMock.testutil').galleryMock)`. */
export const galleryMock = { __esModule: true, MasonryGallery, useGalleryPaging };
