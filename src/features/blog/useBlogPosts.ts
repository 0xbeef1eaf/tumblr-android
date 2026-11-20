import { getBlogPosts } from '@/api/endpoints/blog';
import type { BlogPostsResponse } from '@/api/schemas/blog';
import { normalizePosts } from '@/domain/galleryItem';
import { useGalleryMinItems, useGalleryPaging } from '@/features/gallery';

export const BLOG_PAGE_SIZE = 20;

function toCursor(value: string | number | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

/** `before` for the page after `page`: `_links.next.query_params.before`, else last post timestamp. */
export function blogPageCursor(page: BlogPostsResponse): number | undefined {
  const linked = toCursor(page._links?.next?.query_params?.before);
  if (linked !== undefined) return linked;
  return toCursor(page.posts[page.posts.length - 1]?.timestamp);
}

/** Stops on an empty page or when the cursor did not move between consecutive pages. */
export function blogNextCursor(
  page: BlogPostsResponse,
  allPages: readonly BlogPostsResponse[],
): number | undefined {
  if (page.posts.length === 0) return undefined;
  const cursor = blogPageCursor(page);
  if (cursor === undefined) return undefined;
  const previous = allPages[allPages.length - 2];
  if (previous && blogPageCursor(previous) === cursor) return undefined;
  return cursor;
}

export function blogPostsQueryKey(name: string, tag?: string) {
  return ['blog', name, 'posts', { tag }] as const;
}

/** Infinite gallery of a blog's posts, optionally filtered by `tag` (DESIGN §3.5). */
export function useBlogPosts(name: string, tag?: string, enabled = true) {
  const minItems = useGalleryMinItems();
  return useGalleryPaging<BlogPostsResponse>({
    queryKey: blogPostsQueryKey(name, tag),
    fetchPage: (cursor, signal) =>
      getBlogPosts({ name, tag, before: cursor, limit: BLOG_PAGE_SIZE, signal }),
    getItems: (page) => normalizePosts(page.posts),
    getNextCursor: blogNextCursor,
    enabled: enabled && name.length > 0,
    minItems,
  });
}
