import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { zustandStorage } from '@/lib/storage';

export type SearchEntryType = 'tag' | 'blog';

export interface SearchHistoryEntry {
  type: SearchEntryType;
  value: string;
  /** Unix milliseconds of the last use. */
  at: number;
}

export interface SearchHistoryState {
  entries: SearchHistoryEntry[];
  /** Adds (or moves to the front) a search; dedupes by type + case-insensitive value. */
  add: (type: SearchEntryType, value: string) => void;
  remove: (type: SearchEntryType, value: string) => void;
  clear: () => void;
}

export const SEARCH_HISTORY_KEY = 'tumblr-gallery.search-history';
export const MAX_HISTORY = 20;

export function sameEntry(
  entry: Pick<SearchHistoryEntry, 'type' | 'value'>,
  type: SearchEntryType,
  value: string,
): boolean {
  return entry.type === type && entry.value.toLowerCase() === value.toLowerCase();
}

export const useSearchHistoryStore = create<SearchHistoryState>()(
  persist(
    (set) => ({
      entries: [],
      add: (type, rawValue) => {
        const value = rawValue.trim();
        if (!value) return;
        set((state) => ({
          entries: [
            { type, value, at: Date.now() },
            ...state.entries.filter((entry) => !sameEntry(entry, type, value)),
          ].slice(0, MAX_HISTORY),
        }));
      },
      remove: (type, value) =>
        set((state) => ({ entries: state.entries.filter((e) => !sameEntry(e, type, value)) })),
      clear: () => set({ entries: [] }),
    }),
    {
      name: SEARCH_HISTORY_KEY,
      version: 1,
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({ entries: state.entries }),
    },
  ),
);
