import { searchPosts } from '@/api/endpoints/search';
import { getTagged } from '@/api/endpoints/tagged';
import { ApiError } from '@/api/errors';
import type { Post } from '@/api/schemas/post';
import type { SearchPage } from '@/api/schemas/search';
import { normalizePosts } from '@/domain/galleryItem';
import { useAuthStore } from '@/features/auth/authStore';
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

/** `search`: signed in, `/v2/timeline/search`; `tagged`: guest (API key), `/v2/tagged`. */
export type TagFeedMode = 'search' | 'tagged';

export function taggedQueryKey(tag: string, mode?: TagFeedMode) {
  return mode ? (['tagged', tag, mode] as const) : (['tagged', tag] as const);
}

/** A page from either source; the cursor kind follows the page's source. */
export type TagFeedPage =
  { source: 'search'; page: SearchPage } | { source: 'tagged'; posts: Post[] };

/**
 * Set once `/v2/timeline/search` is refused (it is undocumented, so Tumblr may not offer it to
 * every app): the rest of the session uses `/v2/tagged` without retrying.
 */
let timelineSearchRefused = false;

/** Test hook. */
export function resetTimelineSearchFallback(): void {
  timelineSearchRefused = false;
}

/** 400/403/404 mean "this app cannot use the endpoint"; auth and rate errors do not. */
function isRefusal(error: unknown): boolean {
  return error instanceof ApiError && [400, 403, 404].includes(error.status);
}

const TAGGED_PREFIX = 't:';
const SEARCH_PREFIX = 's:';

async function fetchTagged(tag: string, before: number | undefined, signal: AbortSignal) {
  const posts = await getTagged({ tag, before, limit: TAG_PAGE_SIZE, signal });
  return { source: 'tagged', posts } as const;
}

export async function fetchTagFeedPage(
  tag: string,
  mode: TagFeedMode,
  cursor: string | undefined,
  signal: AbortSignal,
): Promise<TagFeedPage> {
  if (cursor?.startsWith(TAGGED_PREFIX)) {
    return fetchTagged(tag, Number(cursor.slice(TAGGED_PREFIX.length)), signal);
  }
  const next = cursor?.startsWith(SEARCH_PREFIX) ? cursor.slice(SEARCH_PREFIX.length) : undefined;
  // A feed already paging through search results keeps its own cursor.
  if (mode === 'search' && (!timelineSearchRefused || next !== undefined)) {
    try {
      const page = await searchPosts({ query: tag, next, limit: TAG_PAGE_SIZE, signal });
      return { source: 'search', page };
    } catch (error) {
      // Only a refused first page falls back; a later page failing is an ordinary error.
      if (next !== undefined || !isRefusal(error)) throw error;
      timelineSearchRefused = true;
    }
  }
  return fetchTagged(tag, undefined, signal);
}

export function tagFeedNextCursor(
  page: TagFeedPage,
  allPages: readonly TagFeedPage[],
): string | undefined {
  if (page.source === 'search') {
    const { nextQuery, elementCount } = page.page;
    return elementCount === 0 || !nextQuery ? undefined : `${SEARCH_PREFIX}${nextQuery}`;
  }
  const tagged = allPages.flatMap((p) => (p.source === 'tagged' ? [p.posts] : []));
  const before = taggedNextCursor(page.posts, tagged);
  return before === undefined ? undefined : `${TAGGED_PREFIX}${before}`;
}

const pagePosts = (page: TagFeedPage): Post[] =>
  page.source === 'search' ? page.page.posts : page.posts;

/**
 * Infinite gallery of posts for a tag (DESIGN §3.4, ARCHITECTURE §4). Signed in, it uses
 * `/v2/timeline/search` like tumblr.com, so results honour the account's mature-content
 * settings; `/v2/tagged` (which Tumblr filters further) is the guest path and the fallback.
 */
export function useTaggedPosts(tag: string, enabled = true) {
  const minItems = useGalleryMinItems();
  const signedIn = useAuthStore((s) => s.status === 'signedIn');
  const mode: TagFeedMode = signedIn ? 'search' : 'tagged';
  return useGalleryPaging<TagFeedPage, string>({
    queryKey: taggedQueryKey(tag, mode),
    fetchPage: (cursor, signal) => fetchTagFeedPage(tag, mode, cursor, signal),
    getItems: (page) => normalizePosts(pagePosts(page)),
    getNextCursor: tagFeedNextCursor,
    enabled: enabled && tag.length > 0,
    minItems,
  });
}
