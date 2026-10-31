import { z } from 'zod';

import { env as defaultEnv, type Env } from '@/lib/env';
import { createLogger } from '@/lib/log';

/**
 * "Bring your own credentials": the user's own Tumblr app (consumer key + secret), entered in
 * Settings and kept in SecureStore. React-free; `features/credentials` mirrors it into a
 * zustand store for the UI. Build-time `EXPO_PUBLIC_*` values are only a fallback.
 */
const logger = createLogger('credentials');

export const CREDENTIALS_STORE_KEY = 'tumblr.credentials';

export interface TumblrCredentials {
  consumerKey: string;
  consumerSecret?: string;
}

/** Where the effective credentials came from: Settings, the build's env, or nowhere. */
export type CredentialsSource = 'user' | 'env' | 'none';

export interface EffectiveCredentials {
  consumerKey?: string;
  consumerSecret?: string;
  source: CredentialsSource;
}

const CredentialsSchema = z.object({
  consumerKey: z.string().trim().min(1),
  consumerSecret: z.string().trim().optional(),
});

/** Trim both values; an empty secret becomes `undefined`. `null` when the key is empty. */
export function normalizeCredentials(input: {
  consumerKey: string;
  consumerSecret?: string;
}): TumblrCredentials | null {
  const consumerKey = input.consumerKey.trim();
  if (!consumerKey) return null;
  const consumerSecret = input.consumerSecret?.trim();
  return consumerSecret ? { consumerKey, consumerSecret } : { consumerKey };
}

/** String key/value backend: SecureStore on device, a Map under jest. */
export interface SecretBackend {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
}

export function createMemoryBackend(): SecretBackend {
  const map = new Map<string, string>();
  return {
    getItem: async (key) => map.get(key) ?? null,
    setItem: async (key, value) => {
      map.set(key, value);
    },
    deleteItem: async (key) => {
      map.delete(key);
    },
  };
}

function createSecureStoreBackend(): SecretBackend {
  // Lazy require keeps the native module out of non-native contexts.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const SecureStore = require('expo-secure-store') as typeof import('expo-secure-store');
  return {
    getItem: (key) => SecureStore.getItemAsync(key),
    setItem: (key, value) => SecureStore.setItemAsync(key, value),
    deleteItem: (key) => SecureStore.deleteItemAsync(key),
  };
}

export interface CredentialsStore {
  /** Read from the backend (once; later calls return the cache). */
  load(): Promise<TumblrCredentials | null>;
  /** Normalise and persist. Throws when the consumer key is empty. */
  save(credentials: TumblrCredentials): Promise<TumblrCredentials>;
  clear(): Promise<void>;
  /** Synchronous peek; `null` before `load()` resolves or when nothing is stored. */
  get(): TumblrCredentials | null;
  isLoaded(): boolean;
  /** Called after every change (load, save, clear). Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
}

export function createCredentialsStore(backend: SecretBackend): CredentialsStore {
  let cached: TumblrCredentials | null = null;
  let loaded = false;
  let loading: Promise<TumblrCredentials | null> | null = null;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  const read = async (): Promise<TumblrCredentials | null> => {
    try {
      const raw = await backend.getItem(CREDENTIALS_STORE_KEY);
      if (!raw) return null;
      const parsed = CredentialsSchema.safeParse(JSON.parse(raw));
      return parsed.success ? normalizeCredentials(parsed.data) : null;
    } catch (error) {
      logger.warn('Discarding unreadable stored credentials', error);
      return null;
    }
  };

  return {
    load: () => {
      if (loaded) return Promise.resolve(cached);
      loading ??= read().then((value) => {
        // A save/clear that finished while we were reading wins over the stored value.
        if (!loaded) {
          cached = value;
          loaded = true;
          notify();
        }
        loading = null;
        return cached;
      });
      return loading;
    },
    save: async (credentials) => {
      const next = normalizeCredentials(credentials);
      if (!next) throw new Error('The consumer key is required');
      await backend.setItem(CREDENTIALS_STORE_KEY, JSON.stringify(next));
      cached = next;
      loaded = true;
      notify();
      return next;
    },
    clear: async () => {
      await backend.deleteItem(CREDENTIALS_STORE_KEY);
      cached = null;
      loaded = true;
      notify();
    },
    get: () => cached,
    isLoaded: () => loaded,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const isJest = typeof process !== 'undefined' && process.env.JEST_WORKER_ID != null;

/** The app-wide store. Credentials never touch MMKV/AsyncStorage. */
export const credentialsStore: CredentialsStore = createCredentialsStore(
  isJest ? createMemoryBackend() : createSecureStoreBackend(),
);

/**
 * Resolution order: credentials entered in Settings (as a pair — never mixed with a baked-in
 * secret), then the build's `EXPO_PUBLIC_TUMBLR_API_KEY` / `EXPO_PUBLIC_TUMBLR_CLIENT_SECRET`.
 */
export function getEffectiveCredentials(
  e: Env = defaultEnv,
  store: CredentialsStore = credentialsStore,
): EffectiveCredentials {
  const user = store.get();
  if (user) return { ...user, source: 'user' };
  if (e.tumblrApiKey) {
    return e.tumblrClientSecret
      ? { consumerKey: e.tumblrApiKey, consumerSecret: e.tumblrClientSecret, source: 'env' }
      : { consumerKey: e.tumblrApiKey, source: 'env' };
  }
  return { source: 'none' };
}

/** True when guest (`api_key`) requests can be made. */
export function hasApiKey(
  e: Env = defaultEnv,
  store: CredentialsStore = credentialsStore,
): boolean {
  return Boolean(getEffectiveCredentials(e, store).consumerKey);
}
