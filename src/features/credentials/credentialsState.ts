import { useEffect } from 'react';
import { create } from 'zustand';

import {
  credentialsStore,
  getEffectiveCredentials,
  type CredentialsSource,
  type TumblrCredentials,
} from '@/api/credentials';

export type CredentialsStatus = 'loading' | 'ready';

export interface CredentialsState {
  /** `loading` until SecureStore has been read once. */
  status: CredentialsStatus;
  /** What the user entered in Settings (`null` when using the build's key, or none). */
  credentials: TumblrCredentials | null;
  /** Where the effective credentials come from. */
  source: CredentialsSource;
  /** Guest (`api_key`) requests are possible. */
  hasApiKey: boolean;
  /** Trim, validate and persist. Rejects when the consumer key is empty. */
  setCredentials: (credentials: TumblrCredentials) => Promise<TumblrCredentials>;
  clearCredentials: () => Promise<void>;
}

type Snapshot = Pick<CredentialsState, 'status' | 'credentials' | 'source' | 'hasApiKey'>;

function snapshot(): Snapshot {
  const effective = getEffectiveCredentials();
  return {
    status: credentialsStore.isLoaded() ? 'ready' : 'loading',
    credentials: credentialsStore.get(),
    source: effective.source,
    hasApiKey: Boolean(effective.consumerKey),
  };
}

/** React mirror of `credentialsStore` (src/api/credentials.ts); never persisted elsewhere. */
export const useCredentialsStore = create<CredentialsState>()(() => ({
  ...snapshot(),
  setCredentials: (credentials) => credentialsStore.save(credentials),
  clearCredentials: () => credentialsStore.clear(),
}));

credentialsStore.subscribe(() => useCredentialsStore.setState(snapshot()));

/** Read SecureStore once (idempotent). Resolves when `status` is `ready`. */
export function bootstrapCredentials(): Promise<void> {
  return credentialsStore.load().then(() => undefined);
}

/** Loads the stored credentials on mount. `AuthProvider` calls it before the session bootstrap. */
export function useCredentialsBootstrap(): void {
  useEffect(() => {
    void bootstrapCredentials();
  }, []);
}

export interface ApiKeyStatus {
  hasApiKey: boolean;
  /** Still reading SecureStore and no build-time key to fall back on. */
  loading: boolean;
  /** Loaded, and there is no key anywhere: show the "Connect your Tumblr app" card. */
  missing: boolean;
}

/** Gate for screens that make guest requests (`enabled: hasApiKey`). */
export function useApiKeyStatus(): ApiKeyStatus {
  const status = useCredentialsStore((s) => s.status);
  const hasApiKey = useCredentialsStore((s) => s.hasApiKey);
  return {
    hasApiKey,
    loading: status === 'loading' && !hasApiKey,
    missing: status === 'ready' && !hasApiKey,
  };
}
