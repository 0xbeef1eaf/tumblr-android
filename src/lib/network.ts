import * as ExpoNetwork from 'expo-network';
import { NetworkStateType, type NetworkState } from 'expo-network';
import { useSyncExternalStore } from 'react';

export interface NetworkStatus {
  /** `true` until the device reports otherwise (also while loading). */
  isConnected: boolean;
  /** Active connection is mobile data (`NetworkStateType.CELLULAR`). */
  isCellular: boolean;
  /** No state reported yet: callers should not show offline UI. */
  isLoading: boolean;
}

const LOADING: NetworkStatus = { isConnected: true, isCellular: false, isLoading: true };

export function toNetworkStatus(state: NetworkState): NetworkStatus {
  return {
    isConnected: state.isConnected !== false,
    isCellular: state.type === NetworkStateType.CELLULAR,
    isLoading: false,
  };
}

type NetworkApi = Pick<typeof ExpoNetwork, 'getNetworkStateAsync' | 'addNetworkStateListener'>;

export interface NetworkStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => NetworkStatus;
}

/**
 * One native listener for the app's lifetime, started on first subscribe and shared by every
 * hook (the root layout always subscribes, so per-component listeners would only duplicate it).
 */
export function createNetworkStore(api: NetworkApi): NetworkStore {
  let snapshot = LOADING;
  let started = false;
  const listeners = new Set<() => void>();

  const publish = (next: NetworkStatus) => {
    if (
      next.isConnected === snapshot.isConnected &&
      next.isCellular === snapshot.isCellular &&
      next.isLoading === snapshot.isLoading
    ) {
      return;
    }
    snapshot = next;
    for (const listener of listeners) listener();
  };

  const start = () => {
    if (started) return;
    started = true;
    let gotEvent = false;
    api.addNetworkStateListener((state) => {
      gotEvent = true;
      publish(toNetworkStatus(state));
    });
    api.getNetworkStateAsync().then(
      // A change event that raced ahead of the initial read is newer: keep it.
      (state) => !gotEvent && publish(toNetworkStatus(state)),
      // Unknown state: assume online so the app never locks itself out.
      () => !gotEvent && publish({ ...LOADING, isLoading: false }),
    );
  };

  return {
    subscribe: (listener) => {
      start();
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
  };
}

const store = createNetworkStore(ExpoNetwork);

/** Current connectivity (DESIGN §7 offline banner, cellular GIF autoplay, react-query online). */
export function useNetworkState(): NetworkStatus {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
