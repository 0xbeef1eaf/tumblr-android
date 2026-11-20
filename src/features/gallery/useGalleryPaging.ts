import {
  hashKey,
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
  type QueryKey,
} from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import type { GalleryItem } from '@/domain/galleryItem';
import { useSetting } from '@/features/settings/settingsStore';

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
  /** Keep fetching automatically until at least this many items are loaded (default 12). */
  minItems?: number;
  /** A page adding fewer new items than this counts as thin (default `MIN_NEW_ITEMS`). */
  minNewItems?: number;
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
  /** Re-requests every loaded page in order (error-state Retry). */
  refetch: () => Promise<unknown>;
  /**
   * Pull-to-refresh: trims the cache to its first page and refetches only that page, so a
   * personalised feed starts over with fresh content (old page-1 items stay visible meanwhile).
   */
  refresh: () => Promise<unknown>;
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
 * `undefined` for an empty page) or the cursor was already requested (Tumblr pages can
 * repeat). A page without media does not stop paging — see `useGalleryPaging`'s
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

/** A page adding fewer new items than this is "thin": auto-advance keeps going. */
export const MIN_NEW_ITEMS = 6;
/** At most this many automatic fetches in a row (reset by a page adding ≥ MIN_NEW_ITEMS). */
export const MAX_AUTO_PAGES = 8;
/** Default `minItems`; gallery screens pass `columns * MIN_ITEMS_PER_COLUMN`. */
export const DEFAULT_MIN_ITEMS = 12;
export const MIN_ITEMS_PER_COLUMN = 8;

/** Items the last page added that no earlier page had (0 when there are no pages). */
export function lastPageNewItems<TPage>(pages: readonly GalleryPage<TPage>[]): number {
  const seen = new Set<string>();
  let added = 0;
  for (const { items } of pages) {
    added = 0;
    for (const item of items) {
      if (!seen.has(item.id)) added += 1;
      seen.add(item.id);
    }
  }
  return added;
}

/** `minItems` for a masonry screen: enough tiles to fill and scroll the grid. */
export function useGalleryMinItems(): number {
  return useSetting('columns') * MIN_ITEMS_PER_COLUMN;
}

const EMPTY: GalleryItem[] = [];

/** Generic infinite gallery query → flat, deduplicated `GalleryItem[]` (ARCHITECTURE §3). */
export function useGalleryPaging<TPage, TCursor extends Cursor = number>({
  queryKey,
  fetchPage,
  getItems,
  getNextCursor,
  enabled = true,
  minItems = DEFAULT_MIN_ITEMS,
  minNewItems = MIN_NEW_ITEMS,
}: UseGalleryPagingOptions<TPage, TCursor>): GalleryPaging {
  const queryClient = useQueryClient();
  const keyHash = hashKey(queryKey);
  // Callers pass a fresh array each render; its identity only needs to follow the hash.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableKey = useMemo(() => queryKey, [keyHash]);
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

  // Thin pages (text posts, non-post elements, duplicates) may leave the list too short to
  // scroll, so onEndReached never fires again: keep fetching while the list is short or the
  // last page was thin, up to MAX_AUTO_PAGES automatic fetches in a row. `hasNextPage` stays
  // honest after the cap, so a manual fetch (onEndReached) still works.
  const lastNew = useMemo(() => (pages ? lastPageNewItems(pages) : 0), [pages]);
  const autoFetches = useRef(0);
  const wantsMore =
    pages !== undefined &&
    hasNextPage &&
    !query.isFetching &&
    query.error === null &&
    (items.length < minItems || lastNew < minNewItems);
  useEffect(() => {
    if (lastNew >= minNewItems) autoFetches.current = 0;
    if (!wantsMore || autoFetches.current >= MAX_AUTO_PAGES) return;
    autoFetches.current += 1;
    void fetchNext();
  }, [wantsMore, lastNew, minNewItems, fetchNext, pages]);
  const fetchNextPage = useCallback(async (): Promise<unknown> => {
    if (!hasNextPage || isFetchingNextPage) return undefined;
    return fetchNext();
  }, [fetchNext, hasNextPage, isFetchingNextPage]);
  const refetch = useCallback((): Promise<unknown> => refetchAll(), [refetchAll]);
  const refresh = useCallback((): Promise<unknown> => {
    autoFetches.current = 0;
    queryClient.setQueryData<InfiniteData<GalleryPage<TPage>, TCursor | undefined>>(
      stableKey,
      (data) => data && { pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) },
    );
    return refetchAll();
  }, [queryClient, stableKey, refetchAll]);

  return {
    items,
    isLoading: query.isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    refresh,
    isRefetching: query.isRefetching && !isFetchingNextPage,
    error: query.error,
  };
}
