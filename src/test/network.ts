/**
 * In-memory `expo-network` for Jest (wired in src/test/setup.ts). Tests flip it with
 * `setMockNetworkState('cellular')` inside `act`; every test starts on Wi-Fi.
 */
import type * as ExpoNetwork from 'expo-network';
// The real enum module is plain JS with no native code.
import { NetworkStateType } from 'expo-network/build/Network.types';

type NetworkState = ExpoNetwork.NetworkState;

export type NetworkPreset = 'wifi' | 'cellular' | 'offline';

const PRESETS: Record<NetworkPreset, NetworkState> = {
  wifi: { type: NetworkStateType.WIFI, isConnected: true, isInternetReachable: true },
  cellular: { type: NetworkStateType.CELLULAR, isConnected: true, isInternetReachable: true },
  offline: { type: NetworkStateType.NONE, isConnected: false, isInternetReachable: false },
};

let state: NetworkState = PRESETS.wifi;
const listeners = new Set<(state: NetworkState) => void>();

export function setMockNetworkState(next: NetworkPreset | NetworkState): void {
  state = typeof next === 'string' ? PRESETS[next] : next;
  for (const listener of listeners) listener(state);
}

export function resetMockNetworkState(): void {
  setMockNetworkState('wifi');
}

type MockedApi = Pick<
  typeof ExpoNetwork,
  'NetworkStateType' | 'getNetworkStateAsync' | 'addNetworkStateListener' | 'useNetworkState'
>;

export const expoNetworkMock: MockedApi = {
  NetworkStateType,
  getNetworkStateAsync: async () => state,
  addNetworkStateListener: (listener) => {
    listeners.add(listener);
    return { remove: () => void listeners.delete(listener) };
  },
  useNetworkState: () => state,
};
