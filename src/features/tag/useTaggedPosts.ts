import { getTagged } from '@/api/endpoints/tagged';
import type { Post } from '@/api/schemas/post';
import { normalizePosts } from '@/domain/galleryItem';
import { useGalleryMinItems, useGalleryPaging } from '@/features/gallery';

export const TAG_PAGE_SIZE = 20;

/**
 * Unix-seconds `before` cursor of a page. Featured feeds are ordered by
 * `featured_timestamp`, so when every post has one the cursor is the smallest of them;
 * on a mixed page `featured_timestamp` can be later than the post itself, so the
 * smallest `timestamp` is used instead (never re-requesting posts already shown).
 */
export function taggedPageCursor(page: readonly Post[]): number | undefined {
  if (page.length === 0) return undefined;
  const featured = page.flatMap((p) =>
    typeof p.featured_timestamp === 'number' && p.featured_timestamp > 0
      ? [p.featured_timestamp]
      : [],
  );
  const values = featured.length === page.length ? featured : page.map((p) => p.timestamp);
  const cursor = Math.min(...values);
  return Number.isFinite(cursor) && cursor > 0 ? cursor : undefined;
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
  const minItems = useGalleryMinItems();
  return useGalleryPaging<Post[]>({
    queryKey: taggedQueryKey(tag),
    fetchPage: (cursor, signal) => getTagged({ tag, before: cursor, limit: TAG_PAGE_SIZE, signal }),
    getItems: (page) => normalizePosts(page),
    getNextCursor: taggedNextCursor,
    enabled: enabled && tag.length > 0,
    minItems,
  });
}
