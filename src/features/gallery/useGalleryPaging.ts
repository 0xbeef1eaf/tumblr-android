import { useInfiniteQuery, type InfiniteData, type QueryKey } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';

import type { GalleryItem } from '@/domain/galleryItem';

/** Tumblr cursors are numeric (`before` timestamps, offsets); string cursors are allowed too. */
export type Cursor = string | number;

export interface UseGalleryPagingOptions<TPage, TCursor extends Cursor = number> {
  queryKey: QueryKey;
  /** `cursor` is `undefined` for the first page. */
  fetchPage: (cursor: TCursor | undefined, signal: AbortSignal) => Promise<TPage>;
  getItems: (page: TPage) => GalleryItem[];
  /** Return `undefined` to stop paging. */
  getNextCursor: (page: TPage, allPages: TPage[]) => TCursor | undefined;
  enabled?: boolean;
}

/** What is stored in the query cache: the raw page plus its normalised items. */
export interface GalleryPage<TPage> {
  page: TPage;
  items: GalleryItem[];
}

export interface GalleryPaging {
  /** Flattened, deduplicated by `id`; referentially stable while pages are unchanged. */
  items: GalleryItem[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  /** No-op while a page is in flight or when there is nothing more to load. */
  fetchNextPage: () => Promise<unknown>;
  refetch: () => Promise<unknown>;
  isRefetching: boolean;
  error: Error | null;
}

/** Flatten pages into one list, keeping the first occurrence of each item id. */
export function flattenGalleryPages<TPage>(pages: readonly GalleryPage<TPage>[]): GalleryItem[] {
  const seen = new Set<string>();
  const out: GalleryItem[] = [];
  for (const { items } of pages) {
    for (const item of items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
  }
  return out;
}

/**
 * Next page param, or `undefined` to stop: when the caller has no cursor (callers return
 * `undefined` for a page with zero posts) or the cursor was already requested (Tumblr pages
 * can repeat). A page without media does not stop paging — see `useGalleryPaging`'s
 * auto-advance.
 */
export function nextGalleryCursor<TPage, TCursor extends Cursor>(
  pages: readonly GalleryPage<TPage>[],
  pageParams: readonly unknown[],
  getNextCursor: (page: TPage, allPages: TPage[]) => TCursor | undefined,
): TCursor | undefined {
  const last = pages[pages.length - 1];
  if (!last) return undefined;
  const cursor = getNextCursor(
    last.page,
    pages.map((p) => p.page),
  );
  if (cursor === undefined || pageParams.includes(cursor)) return undefined;
  return cursor;
}

/** Auto-advance stops after this many consecutive pages that brought no new items. */
export const MAX_ITEMLESS_PAGES = 5;

/** Number of trailing pages that added no item unseen in the pages before them. */
export function trailingItemlessPages<TPage>(pages: readonly GalleryPage<TPage>[]): number {
  const seen = new Set<string>();
  let trailing = 0;
  for (const { items } of pages) {
    let addsNew = false;
    for (const item of items) {
      if (!seen.has(item.id)) addsNew = true;
      seen.add(item.id);
    }
    trailing = addsNew ? 0 : trailing + 1;
  }
  return trailing;
}

const EMPTY: GalleryItem[] = [];

/** Generic infinite gallery query → flat, deduplicated `GalleryItem[]` (ARCHITECTURE §3). */
export function useGalleryPaging<TPage, TCursor extends Cursor = number>({
  queryKey,
  fetchPage,
  getItems,
  getNextCursor,
  enabled = true,
}: UseGalleryPagingOptions<TPage, TCursor>): GalleryPaging {
  const query = useInfiniteQuery<
    GalleryPage<TPage>,
    Error,
    InfiniteData<GalleryPage<TPage>, TCursor | undefined>,
    QueryKey,
    TCursor | undefined
  >({
    queryKey,
    enabled,
    initialPageParam: undefined,
    // Normalise once at fetch time so renders only flatten (and the cache stays JSON).
    queryFn: async ({ pageParam, signal }) => {
      // Cast: QueryFunctionContext's conditional type cannot resolve for a generic param.
      const page = await fetchPage(pageParam as TCursor | undefined, signal);
      return { page, items: getItems(page) };
    },
    getNextPageParam: (_last, allPages, _lastParam, allParams) =>
      nextGalleryCursor(allPages, allParams, getNextCursor),
  });

  const pages = query.data?.pages;
  const items = useMemo(() => (pages ? flattenGalleryPages(pages) : EMPTY), [pages]);

  const { hasNextPage, isFetchingNextPage, fetchNextPage: fetchNext, refetch: refetchAll } = query;

  // A page of text-only posts renders nothing, so the list's onEndReached may never fire
  // again: fetch the next page automatically, up to MAX_ITEMLESS_PAGES in a row.
  const itemless = useMemo(() => (pages ? trailingItemlessPages(pages) : 0), [pages]);
  const autoAdvance =
    itemless > 0 &&
    itemless < MAX_ITEMLESS_PAGES &&
    hasNextPage &&
    !query.isFetching &&
    !query.isFetchNextPageError;
  useEffect(() => {
    if (autoAdvance) void fetchNext();
  }, [autoAdvance, fetchNext, pages]);
  const fetchNextPage = useCallback(async (): Promise<unknown> => {
    if (!hasNextPage || isFetchingNextPage) return undefined;
    return fetchNext();
  }, [fetchNext, hasNextPage, isFetchingNextPage]);
  const refetch = useCallback((): Promise<unknown> => refetchAll(), [refetchAll]);

  return {
    items,
    isLoading: query.isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    isRefetching: query.isRefetching && !isFetchingNextPage,
    error: query.error,
  };
}
