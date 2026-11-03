import { getForYou } from '@/api/endpoints/user';
import type { ForYouPage } from '@/api/schemas/user';
import { normalizePosts } from '@/domain/galleryItem';
import { useGalleryPaging } from '@/features/gallery';

import { useAuthStore } from './authStore';
import type { GalleryFeed } from './feed';

const PAGE_SIZE = 20;

/**
 * Tumblr's algorithmic "For You" feed (`/v2/tabs/for_you`, undocumented; see API.md),
 * paged by the opaque cursor from `_links.next`.
 */
export function useForYou(): GalleryFeed {
  const signedIn = useAuthStore((s) => s.status === 'signedIn');
  return useGalleryPaging<ForYouPage, string>({
    queryKey: ['forYou'],
    fetchPage: (cursor, signal) => getForYou({ cursor, limit: PAGE_SIZE, signal }),
    getItems: (page) => normalizePosts(page.posts),
    getNextCursor: (page) => (page.posts.length === 0 ? undefined : page.nextCursor),
    enabled: signedIn,
  });
}
