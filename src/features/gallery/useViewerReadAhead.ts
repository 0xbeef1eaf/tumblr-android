import { useEffect, useRef } from 'react';

import { useViewerStore } from './viewerStore';

/** Read-ahead for galleries that do not configure one (tag, blog, search, likes). */
export const DEFAULT_VIEWER_BUFFER = 10;
/** Give up after this many fetches in a row that add nothing (filtered or duplicate pages). */
export const MAX_STALLED_FETCHES = 5;

/** True when fewer than `buffer` items are loaded after the one being viewed. */
export function needsReadAhead(itemCount: number, index: number, buffer: number): boolean {
  return itemCount - 1 - index < buffer;
}

export interface ViewerReadAheadOptions {
  /** The gallery's viewer source id (`useViewerStore().source`). */
  source: string;
  /** Items the viewer can page through (after any kind filter). */
  itemCount: number;
  /** Items to keep loaded ahead of the one on screen. */
  buffer: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  /** Fetches the next page; must be safe to call when a fetch is already running. */
  loadMore: () => void;
}

/**
 * Keeps the full-screen viewer supplied: while it is open for this gallery, fetch pages until
 * `buffer` items are loaded past the current one. Re-evaluated when the viewer moves, when a
 * page arrives and when a fetch settles, so thin pages (For You) are followed by another
 * fetch instead of leaving the user at the last image.
 */
export function useViewerReadAhead({
  source,
  itemCount,
  buffer,
  hasNextPage,
  isFetchingNextPage,
  loadMore,
}: ViewerReadAheadOptions): void {
  const index = useViewerStore((s) => (s.isOpen && s.source === source ? s.index : -1));
  const stalled = useRef({ itemCount, fetches: 0 });

  useEffect(() => {
    if (index < 0 || !hasNextPage || isFetchingNextPage) return;
    if (!needsReadAhead(itemCount, index, buffer)) return;
    if (stalled.current.itemCount !== itemCount) stalled.current = { itemCount, fetches: 0 };
    if (stalled.current.fetches >= MAX_STALLED_FETCHES) return;
    stalled.current.fetches += 1;
    loadMore();
  }, [buffer, hasNextPage, index, isFetchingNextPage, itemCount, loadMore]);
}
