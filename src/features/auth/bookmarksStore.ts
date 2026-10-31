import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { GalleryItem } from '@/domain/galleryItem';
import { zustandStorage } from '@/lib/storage';

export const BOOKMARKS_STORE_KEY = 'tumblr-gallery.bookmarks';
export const MAX_BOOKMARKS = 300;

/** Guest-mode "likes": gallery items saved on this device only (newest first). */
export interface BookmarksState {
  items: GalleryItem[];
  has: (itemId: string) => boolean;
  /** Add or remove; resolves to whether the item is bookmarked afterwards. */
  toggle: (item: GalleryItem) => boolean;
  remove: (itemId: string) => void;
  clear: () => void;
}

export const useBookmarksStore = create<BookmarksState>()(
  persist(
    (set, get) => ({
      items: [],
      has: (itemId) => get().items.some((i) => i.id === itemId),
      toggle: (item) => {
        const exists = get().items.some((i) => i.id === item.id);
        set((state) => ({
          items: exists
            ? state.items.filter((i) => i.id !== item.id)
            : [{ ...item, liked: true }, ...state.items].slice(0, MAX_BOOKMARKS),
        }));
        return !exists;
      },
      remove: (itemId) => set((state) => ({ items: state.items.filter((i) => i.id !== itemId) })),
      clear: () => set({ items: [] }),
    }),
    {
      name: BOOKMARKS_STORE_KEY,
      version: 1,
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({ items: state.items }),
    },
  ),
);
