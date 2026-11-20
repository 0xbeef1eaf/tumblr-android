import { Dimensions } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { zustandStorage } from '@/lib/storage';
import { layout } from '@/ui/theme';

export type GridColumns = 2 | 3;

/** Posts kept loaded ahead of the one shown in the full-screen viewer. */
export const FEED_BUFFER_OPTIONS = [10, 20, 40, 80] as const;
export type FeedBuffer = (typeof FEED_BUFFER_OPTIONS)[number];

export interface Settings {
  columns: GridColumns;
  showBlogName: boolean;
  safeMode: boolean;
  /** Off: gallery GIFs show their first frame on mobile data (`useVisibleGifs`). */
  autoplayGifsOnCellular: boolean;
  autoplayVideo: boolean;
  /** Viewer read-ahead on the Dashboard tab (`useViewerReadAhead`). */
  dashboardBuffer: FeedBuffer;
  /** Viewer read-ahead on the For You tab; its pages are thinner, so the default is larger. */
  forYouBuffer: FeedBuffer;
}

export interface SettingsState extends Settings {
  setColumns: (columns: GridColumns) => void;
  setShowBlogName: (value: boolean) => void;
  setSafeMode: (value: boolean) => void;
  setAutoplayGifsOnCellular: (value: boolean) => void;
  setAutoplayVideo: (value: boolean) => void;
  setDashboardBuffer: (value: FeedBuffer) => void;
  setForYouBuffer: (value: FeedBuffer) => void;
  reset: () => void;
}

export const SETTINGS_STORE_KEY = 'tumblr-gallery.settings';

/** DESIGN §3.8: 2 columns on phones < 600 dp, 3 otherwise. */
export function defaultColumns(windowWidth: number): GridColumns {
  return windowWidth < layout.wideBreakpoint ? 2 : 3;
}

export function defaultSettings(windowWidth = Dimensions.get('window').width): Settings {
  return {
    columns: defaultColumns(windowWidth),
    showBlogName: true,
    safeMode: true,
    autoplayGifsOnCellular: true,
    autoplayVideo: false,
    dashboardBuffer: 20,
    forYouBuffer: 40,
  };
}

function pickSettings(state: Settings): Settings {
  return {
    columns: state.columns,
    showBlogName: state.showBlogName,
    safeMode: state.safeMode,
    autoplayGifsOnCellular: state.autoplayGifsOnCellular,
    autoplayVideo: state.autoplayVideo,
    dashboardBuffer: state.dashboardBuffer,
    forYouBuffer: state.forYouBuffer,
  };
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings(),
      setColumns: (columns) => set({ columns }),
      setShowBlogName: (showBlogName) => set({ showBlogName }),
      setSafeMode: (safeMode) => set({ safeMode }),
      setAutoplayGifsOnCellular: (autoplayGifsOnCellular) => set({ autoplayGifsOnCellular }),
      setAutoplayVideo: (autoplayVideo) => set({ autoplayVideo }),
      setDashboardBuffer: (dashboardBuffer) => set({ dashboardBuffer }),
      setForYouBuffer: (forYouBuffer) => set({ forYouBuffer }),
      reset: () => set(defaultSettings()),
    }),
    {
      name: SETTINGS_STORE_KEY,
      version: 1,
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state: SettingsState): Settings => pickSettings(state),
    },
  ),
);

/** Convenience selector hook: `const columns = useSetting('columns')`. */
export function useSetting<K extends keyof Settings>(key: K): Settings[K] {
  return useSettingsStore((state) => state[key]);
}
