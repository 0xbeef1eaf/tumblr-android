import type { StateStorage } from 'zustand/middleware';

import { createLogger } from './log';

const logger = createLogger('storage');

/** Minimal synchronous key-value surface shared by MMKV and the in-memory fallback. */
export interface KeyValueStore {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): void;
  getAllKeys(): string[];
  clearAll(): void;
}

export function createMemoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    getString: (key) => map.get(key),
    set: (key, value) => {
      map.set(key, value);
    },
    remove: (key) => {
      map.delete(key);
    },
    getAllKeys: () => [...map.keys()],
    clearAll: () => map.clear(),
  };
}

function createNativeStore(id: string): KeyValueStore {
  // Required lazily so jest (and environments without the Nitro module) never load native code.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createMMKV } = require('react-native-mmkv') as typeof import('react-native-mmkv');
  const mmkv = createMMKV({ id });
  return {
    getString: (key) => mmkv.getString(key),
    set: (key, value) => mmkv.set(key, value),
    remove: (key) => {
      mmkv.remove(key);
    },
    getAllKeys: () => mmkv.getAllKeys(),
    clearAll: () => mmkv.clearAll(),
  };
}

const isJest = typeof process !== 'undefined' && process.env.JEST_WORKER_ID != null;

export function createKeyValueStore(id: string): KeyValueStore {
  if (isJest) return createMemoryStore();
  try {
    return createNativeStore(id);
  } catch (error) {
    logger.warn(`MMKV unavailable for "${id}", falling back to memory`, error);
    return createMemoryStore();
  }
}

/** App-wide stores: zustand state and the react-query cache live in separate files. */
export const appStorage = createKeyValueStore('tumblr-gallery');
export const queryCacheStorage = createKeyValueStore('tumblr-gallery-query-cache');

/** zustand `persist` adapter (use with `createJSONStorage(() => zustandStorage)`). */
export function createStateStorage(store: KeyValueStore): StateStorage {
  return {
    getItem: (name) => store.getString(name) ?? null,
    setItem: (name, value) => store.set(name, value),
    removeItem: (name) => store.remove(name),
  };
}

export const zustandStorage: StateStorage = createStateStorage(appStorage);
