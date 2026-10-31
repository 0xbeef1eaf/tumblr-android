import { create } from 'zustand';

import type { GalleryItem } from '@/domain/galleryItem';

export interface OpenViewerOptions {
  /** Identifies the gallery that opened the viewer, so it can keep `items` in sync. */
  source?: string;
  /** Called by the viewer when the user nears the end of `items`. */
  onLoadMore?: () => void;
}

export interface ViewerState {
  items: GalleryItem[];
  index: number;
  isOpen: boolean;
  source?: string;
  onLoadMore?: () => void;
  open: (items: GalleryItem[], index: number, options?: OpenViewerOptions) => void;
  close: () => void;
  setIndex: (index: number) => void;
  /** Replace `items` (e.g. a new page arrived) when the viewer is open for `source`. */
  syncItems: (source: string, items: GalleryItem[]) => void;
}

function clampIndex(index: number, length: number): number {
  if (length === 0) return 0;
  return Math.min(length - 1, Math.max(0, Math.trunc(index)));
}

const closed = {
  items: [] as GalleryItem[],
  index: 0,
  isOpen: false,
  source: undefined,
  onLoadMore: undefined,
};

/**
 * In-memory hand-off from a gallery to `/viewer` (DESIGN §3.7): items are not serialised
 * into the URL. Never persisted.
 */
export const useViewerStore = create<ViewerState>()((set, get) => ({
  ...closed,
  open: (items, index, options = {}) => {
    if (items.length === 0) return;
    set({
      items,
      index: clampIndex(index, items.length),
      isOpen: true,
      source: options.source,
      onLoadMore: options.onLoadMore,
    });
  },
  close: () => set(closed),
  setIndex: (index) => set((state) => ({ index: clampIndex(index, state.items.length) })),
  syncItems: (source, items) => {
    const state = get();
    if (!state.isOpen || state.source !== source || state.items === items) return;
    // A transient empty list (refresh, filter change) never yanks the viewer away.
    if (items.length === 0) return;
    // Keep the current item selected even if earlier items were filtered out.
    const currentId = state.items[state.index]?.id;
    const found = currentId ? items.findIndex((item) => item.id === currentId) : -1;
    set({ items, index: clampIndex(found >= 0 ? found : state.index, items.length) });
  },
}));
