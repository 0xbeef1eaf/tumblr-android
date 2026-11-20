import type { GalleryItem } from '@/domain/galleryItem';

/** What `MasonryGallery` needs from a paged source (structurally `useGalleryPaging`'s result). */
export interface GalleryFeed {
  items: GalleryItem[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => unknown;
  refetch: () => unknown;
  /** Pull-to-refresh: start over from the first page. */
  refresh: () => unknown;
  isRefetching: boolean;
  error: unknown;
}
