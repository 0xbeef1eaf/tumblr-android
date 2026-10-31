import { useMemo } from 'react';

import { getLikes } from '@/api/endpoints/user';
import { normalizePosts } from '@/domain/galleryItem';
import { useGalleryPaging } from '@/features/gallery';

import { useAuthStore } from './authStore';
import { useBookmarksStore } from './bookmarksStore';
import type { GalleryFeed } from './feed';

const PAGE_SIZE = 20;
const noop = () => undefined;

/**
 * Signed in: `/user/likes`, paged with `before` = the last `liked_timestamp`.
 * Guest: the on-device bookmarks (see `bookmarksStore`).
 */
export function useLikes(): GalleryFeed {
  const signedIn = useAuthStore((s) => s.status === 'signedIn');
  const bookmarks = useBookmarksStore((s) => s.items);
  const remote = useGalleryPaging({
    queryKey: ['likes'],
    fetchPage: (before, signal) => getLikes({ before, limit: PAGE_SIZE, signal }),
    getItems: (page) => normalizePosts(page.liked_posts).map((item) => ({ ...item, liked: true })),
    getNextCursor: (page) => {
      const last = page.liked_posts.at(-1)?.liked_timestamp;
      return page.liked_posts.length === 0 || last === undefined ? undefined : last;
    },
    enabled: signedIn,
  });

  const local = useMemo<GalleryFeed>(
    () => ({
      items: bookmarks,
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: noop,
      refetch: noop,
      isRefetching: false,
      error: null,
    }),
    [bookmarks],
  );

  return signedIn ? remote : local;
}
