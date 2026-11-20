import { getDashboard } from '@/api/endpoints/user';
import { normalizePosts } from '@/domain/galleryItem';
import { useGalleryMinItems, useGalleryPaging } from '@/features/gallery';

import { useAuthStore } from './authStore';
import type { GalleryFeed } from './feed';

/** `/user/dashboard` caps `limit` at 20 (API.md). */
const PAGE_SIZE = 20;

/** Media from followed blogs (`offset` paging; cursor = number of posts seen so far). */
export function useDashboard(): GalleryFeed {
  const signedIn = useAuthStore((s) => s.status === 'signedIn');
  const minItems = useGalleryMinItems();
  return useGalleryPaging({
    queryKey: ['dashboard'],
    fetchPage: (cursor, signal) => getDashboard({ offset: cursor, limit: PAGE_SIZE, signal }),
    getItems: (page) => normalizePosts(page.posts),
    getNextCursor: (page, allPages) =>
      page.posts.length === 0
        ? undefined
        : allPages.reduce((count, p) => count + p.posts.length, 0),
    enabled: signedIn,
    minItems,
  });
}
