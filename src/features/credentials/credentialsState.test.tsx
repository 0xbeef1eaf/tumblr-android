import { act, renderHook } from '@testing-library/react-native';

import { credentialsStore } from '@/api/credentials';

import {
  bootstrapCredentials,
  useApiKeyStatus,
  useCredentialsBootstrap,
  useCredentialsStore,
} from './credentialsState';

describe('useCredentialsStore', () => {
  it('mirrors the secure store', async () => {
    expect(useCredentialsStore.getState()).toMatchObject({
      status: 'ready',
      credentials: { consumerKey: 'test' },
      source: 'user',
      hasApiKey: true,
    });
    await useCredentialsStore
      .getState()
      .setCredentials({ consumerKey: ' k ', consumerSecret: 's' });
    expect(credentialsStore.get()).toEqual({ consumerKey: 'k', consumerSecret: 's' });
    expect(useCredentialsStore.getState().credentials).toEqual({
      consumerKey: 'k',
      consumerSecret: 's',
    });
    await useCredentialsStore.getState().clearCredentials();
    expect(useCredentialsStore.getState()).toMatchObject({
      credentials: null,
      source: 'none',
      hasApiKey: false,
    });
  });

  it('bootstraps idempotently', async () => {
    await expect(bootstrapCredentials()).resolves.toBeUndefined();
    const { unmount } = await renderHook(() => useCredentialsBootstrap());
    await unmount();
    expect(useCredentialsStore.getState().status).toBe('ready');
  });
});

describe('useApiKeyStatus', () => {
  it('reports loading, missing and ready', async () => {
    const { result } = await renderHook(() => useApiKeyStatus());
    expect(result.current).toEqual({ hasApiKey: true, loading: false, missing: false });

    await act(() => {
      useCredentialsStore.setState({ status: 'loading', hasApiKey: false });
    });
    expect(result.current).toEqual({ hasApiKey: false, loading: true, missing: false });

    await act(() => credentialsStore.clear());
    expect(result.current).toEqual({ hasApiKey: false, loading: false, missing: true });
  });
});
