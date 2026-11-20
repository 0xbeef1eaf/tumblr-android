import { getForYou } from '@/api/endpoints/user';
import type { ForYouPage } from '@/api/schemas/user';
import { normalizePosts } from '@/domain/galleryItem';
import { useGalleryMinItems, useGalleryPaging } from '@/features/gallery';

import { useAuthStore } from './authStore';
import type { GalleryFeed } from './feed';

/** The endpoint takes `limit`; if Tumblr caps it lower, pages are just shorter. */
const PAGE_SIZE = 40;

/**
 * A page whose elements are all non-post objects (blog carousels, ads) can still carry a
 * cursor: paging stops only when there is no cursor or the page had no elements at all.
 */
export function forYouNextCursor(page: ForYouPage): string | undefined {
  return page.elementCount === 0 ? undefined : page.nextCursor;
}

/**
 * Tumblr's algorithmic "For You" feed (`/v2/tabs/for_you`, undocumented; see API.md),
 * paged by the opaque cursor from `_links.next`.
 */

export function useForYou(): GalleryFeed {
  const signedIn = useAuthStore((s) => s.status === 'signedIn');
  const minItems = useGalleryMinItems();
  return useGalleryPaging<ForYouPage, string>({
    queryKey: ['forYou'],
    fetchPage: (cursor, signal) => getForYou({ cursor, limit: PAGE_SIZE, signal }),
    getItems: (page) => normalizePosts(page.posts),
    getNextCursor: forYouNextCursor,
    enabled: signedIn,
    minItems,
  });
}
