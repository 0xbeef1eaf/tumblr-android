import { getTagged } from '@/api/endpoints/tagged';
import type { Post } from '@/api/schemas/post';
import { normalizePosts } from '@/domain/galleryItem';
import { useGalleryPaging } from '@/features/gallery';

export const TAG_PAGE_SIZE = 20;

/** Unix-seconds `before` cursor of a page: `featured_timestamp` of the last post, else `timestamp`. */
export function taggedPageCursor(page: readonly Post[]): number | undefined {
  const last = page[page.length - 1];
  if (!last) return undefined;
  const cursor = last.featured_timestamp ?? last.timestamp;
  return cursor > 0 ? cursor : undefined;
}

/**
 * Next `before` for `/tagged`. Stops on an empty page or when the cursor did not move
 * (Tumblr pages can overlap or repeat at the end of a tag).
 */
export function taggedNextCursor(
  page: readonly Post[],
  allPages: readonly (readonly Post[])[],
): number | undefined {
  const cursor = taggedPageCursor(page);
  if (cursor === undefined) return undefined;
  const previous = allPages[allPages.length - 2];
  if (previous && taggedPageCursor(previous) === cursor) return undefined;
  return cursor;
}

export function taggedQueryKey(tag: string) {
  return ['tagged', tag] as const;
}

/** Infinite gallery of posts for a tag (DESIGN §3.4, ARCHITECTURE §4). */
export function useTaggedPosts(tag: string, enabled = true) {
  return useGalleryPaging<Post[]>({
    queryKey: taggedQueryKey(tag),
    fetchPage: (cursor, signal) => getTagged({ tag, before: cursor, limit: TAG_PAGE_SIZE, signal }),
    getItems: (page) => normalizePosts(page),
    getNextCursor: taggedNextCursor,
    enabled: enabled && tag.length > 0,
  });
}
