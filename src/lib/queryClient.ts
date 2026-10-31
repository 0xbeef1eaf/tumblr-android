import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { onlineManager, QueryClient, type Query } from '@tanstack/react-query';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import { useEffect } from 'react';

import { configureApiClient } from '@/api/client';
import { ApiError, MissingCredentialsError } from '@/api/errors';

import { env } from './env';
import { useNetworkState } from './network';
import { queryCacheStorage, type KeyValueStore } from './storage';

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const PERSIST_MAX_AGE = 24 * HOUR;

/** Only gallery pages are persisted (ARCHITECTURE §3) — never auth or user data. */
export const PERSISTED_QUERY_ROOTS = ['tagged', 'blog', 'dashboard', 'likes'] as const;

export function shouldPersistQuery(query: Pick<Query, 'queryKey' | 'state'>): boolean {
  const root = query.queryKey[0];
  return (
    query.state.status === 'success' &&
    typeof root === 'string' &&
    (PERSISTED_QUERY_ROOTS as readonly string[]).includes(root)
  );
}

/** Retry transient failures twice; never retry client errors (429 is handled in apiFetch). */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof MissingCredentialsError) return false;
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}

/** DESIGN §7 copy for a 429 that is about to be retried. */
export function rateLimitMessage(retryAfterSec: number): string {
  return `Tumblr is asking us to slow down — retrying in ${retryAfterSec}s`;
}

/** Route the API client's 429 retries to a toast (`show` is `toast.show` in the app). */
export function installRateLimitToast(show: (message: string) => void): () => void {
  return configureApiClient({ onRateLimited: (sec) => show(rateLimitMessage(sec)) });
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * MINUTE,
        // Must be ≥ the persister maxAge or restored queries are garbage-collected at once.
        gcTime: PERSIST_MAX_AGE,
        retry: shouldRetry,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}

export function createQueryPersister(store: KeyValueStore = queryCacheStorage) {
  return createAsyncStoragePersister({
    storage: {
      getItem: (key) => store.getString(key) ?? null,
      setItem: (key, value) => store.set(key, value),
      removeItem: (key) => store.remove(key),
    },
    key: 'tumblr-gallery.query-cache',
    throttleTime: 1000,
  });
}

export const queryClient = createQueryClient();

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister: createQueryPersister(),
  maxAge: PERSIST_MAX_AGE,
  // A new app version discards the cache (schemas/normalisation may have changed).
  buster: env.appVersion,
  dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
};

/**
 * Feed expo-network's connectivity to react-query (call once, in the root layout): offline
 * queries pause instead of failing and refetch on reconnect; persisted pages stay readable.
 * Waits for the first reading so a cold start never flashes offline.
 */
export function useSyncOnlineManager(): void {
  const { isConnected, isLoading } = useNetworkState();
  useEffect(() => {
    if (!isLoading) onlineManager.setOnline(isConnected);
  }, [isConnected, isLoading]);
}
