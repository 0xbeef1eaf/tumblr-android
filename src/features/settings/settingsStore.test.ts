import { act } from '@testing-library/react-native';

import { appStorage } from '@/lib/storage';

import {
  defaultColumns,
  defaultSettings,
  SETTINGS_STORE_KEY,
  useSettingsStore,
} from './settingsStore';

beforeEach(() => {
  useSettingsStore.getState().reset();
});

describe('settingsStore', () => {
  it.each([
    [360, 2],
    [599, 2],
    [600, 3],
    [1024, 3],
  ])('default columns for %idp → %i', (width, expected) => {
    expect(defaultColumns(width)).toBe(expected);
    expect(defaultSettings(width).columns).toBe(expected);
  });

  it('has the documented defaults', () => {
    expect(defaultSettings(400)).toEqual({
      columns: 2,
      showBlogName: true,
      safeMode: true,
      autoplayGifsOnCellular: true,
      autoplayVideo: false,
      dashboardBuffer: 20,
      forYouBuffer: 40,
    });
  });

  it('updates and persists only the settings fields', async () => {
    await act(async () => {
      const s = useSettingsStore.getState();
      s.setColumns(3);
      s.setShowBlogName(false);
      s.setSafeMode(false);
      s.setAutoplayGifsOnCellular(false);
      s.setAutoplayVideo(true);
      s.setDashboardBuffer(80);
      s.setForYouBuffer(10);
    });
    const state = useSettingsStore.getState();
    expect(state).toMatchObject({
      columns: 3,
      showBlogName: false,
      safeMode: false,
      autoplayGifsOnCellular: false,
      autoplayVideo: true,
      dashboardBuffer: 80,
      forYouBuffer: 10,
    });
    const persisted = JSON.parse(appStorage.getString(SETTINGS_STORE_KEY) ?? '{}');
    expect(persisted.state).toEqual({
      columns: 3,
      showBlogName: false,
      safeMode: false,
      autoplayGifsOnCellular: false,
      autoplayVideo: true,
      dashboardBuffer: 80,
      forYouBuffer: 10,
    });
    expect(persisted.version).toBe(1);
  });

  it('rehydrates from storage', async () => {
    appStorage.set(
      SETTINGS_STORE_KEY,
      JSON.stringify({ state: { columns: 3, safeMode: false }, version: 1 }),
    );
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState()).toMatchObject({ columns: 3, safeMode: false });
  });

  it('gives settings saved before the feed buffers existed their defaults', async () => {
    // Writing to the store persists it, so seed the old-format payload afterwards.
    useSettingsStore.setState(defaultSettings(400));
    appStorage.set(SETTINGS_STORE_KEY, JSON.stringify({ state: { columns: 3 }, version: 1 }));
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState()).toMatchObject({
      columns: 3,
      dashboardBuffer: 20,
      forYouBuffer: 40,
    });
  });

  it('reset restores defaults', () => {
    useSettingsStore.getState().setSafeMode(false);
    useSettingsStore.getState().reset();
    expect(useSettingsStore.getState().safeMode).toBe(true);
  });
});
