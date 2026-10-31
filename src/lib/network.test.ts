import { act, renderHook } from '@testing-library/react-native';
import { NetworkStateType, type NetworkState } from 'expo-network';

import { setMockNetworkState } from '@/test/network';

import { createNetworkStore, toNetworkStatus, useNetworkState } from './network';

describe('toNetworkStatus', () => {
  it.each([
    [{ type: NetworkStateType.WIFI, isConnected: true }, true, false],
    [{ type: NetworkStateType.CELLULAR, isConnected: true }, true, true],
    [{ type: NetworkStateType.NONE, isConnected: false }, false, false],
    // Unknown connectivity counts as online: never lock the app out on a missing field.
    [{}, true, false],
  ])('%j → connected %s, cellular %s', (state, isConnected, isCellular) => {
    expect(toNetworkStatus(state)).toEqual({ isConnected, isCellular, isLoading: false });
  });
});

describe('useNetworkState', () => {
  it('reports the device state and follows changes', async () => {
    const { result } = await renderHook(() => useNetworkState());
    expect(result.current).toEqual({ isConnected: true, isCellular: false, isLoading: false });

    await act(async () => setMockNetworkState('cellular'));
    expect(result.current).toEqual({ isConnected: true, isCellular: true, isLoading: false });

    await act(async () => setMockNetworkState('offline'));
    expect(result.current).toEqual({ isConnected: false, isCellular: false, isLoading: false });
  });

  it('shares one snapshot between consumers and keeps it referentially stable', async () => {
    const a = await renderHook(() => useNetworkState());
    const b = await renderHook(() => useNetworkState());
    expect(a.result.current).toBe(b.result.current);
    const before = a.result.current;
    await act(async () => setMockNetworkState('wifi'));
    expect(a.result.current).toBe(before);
  });
});

describe('createNetworkStore', () => {
  function fakeApi() {
    let emit: (state: NetworkState) => void = () => {};
    let settle: { resolve: (s: NetworkState) => void; reject: (e: Error) => void } | undefined;
    const api = {
      addNetworkStateListener: jest.fn((listener: (state: NetworkState) => void) => {
        emit = listener;
        return { remove: jest.fn() };
      }),
      getNetworkStateAsync: jest.fn(
        () =>
          new Promise<NetworkState>((resolve, reject) => {
            settle = { resolve, reject };
          }),
      ),
    };
    return { api, emit: (s: NetworkState) => emit(s), settle: () => settle! };
  }
  const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

  it('is loading (and online) until the first read, then starts only once', async () => {
    const fake = fakeApi();
    const store = createNetworkStore(fake.api);
    const listener = jest.fn();
    store.subscribe(listener);
    store.subscribe(jest.fn());
    expect(store.getSnapshot()).toEqual({ isConnected: true, isCellular: false, isLoading: true });
    expect(fake.api.addNetworkStateListener).toHaveBeenCalledTimes(1);

    fake.settle().resolve({ type: NetworkStateType.NONE, isConnected: false });
    await flush();
    expect(store.getSnapshot()).toEqual({
      isConnected: false,
      isCellular: false,
      isLoading: false,
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keeps a change event that arrives before the initial read', async () => {
    const fake = fakeApi();
    const store = createNetworkStore(fake.api);
    store.subscribe(jest.fn());
    fake.emit({ type: NetworkStateType.CELLULAR, isConnected: true });
    fake.settle().resolve({ type: NetworkStateType.WIFI, isConnected: true });
    await flush();
    expect(store.getSnapshot().isCellular).toBe(true);
  });

  it('assumes online when the initial read fails', async () => {
    const fake = fakeApi();
    const store = createNetworkStore(fake.api);
    store.subscribe(jest.fn());
    fake.settle().reject(new Error('no native module'));
    await flush();
    expect(store.getSnapshot()).toEqual({ isConnected: true, isCellular: false, isLoading: false });
  });
});
