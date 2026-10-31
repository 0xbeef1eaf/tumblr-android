import * as SecureStore from 'expo-secure-store';

import type { Env } from '@/lib/env';

import {
  createCredentialsStore,
  createMemoryBackend,
  CREDENTIALS_STORE_KEY,
  credentialsStore,
  getEffectiveCredentials,
  hasApiKey,
  normalizeCredentials,
  type SecretBackend,
} from './credentials';

const env = (partial: Partial<Env> = {}): Env => ({
  appVersion: '1.0.0',
  isTest: true,
  ...partial,
});

/** The jest SecureStore mock (src/test/setup.ts) as a backend. */
const secureBackend: SecretBackend = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  deleteItem: (key) => SecureStore.deleteItemAsync(key),
};

describe('normalizeCredentials', () => {
  it('trims and drops an empty secret', () => {
    expect(normalizeCredentials({ consumerKey: ' k ', consumerSecret: ' s ' })).toEqual({
      consumerKey: 'k',
      consumerSecret: 's',
    });
    expect(normalizeCredentials({ consumerKey: 'k', consumerSecret: '  ' })).toEqual({
      consumerKey: 'k',
    });
    expect(normalizeCredentials({ consumerKey: '   ', consumerSecret: 's' })).toBeNull();
  });
});

describe('createCredentialsStore', () => {
  it('round-trips through SecureStore under one JSON key', async () => {
    const store = createCredentialsStore(secureBackend);
    expect(store.get()).toBeNull();
    expect(store.isLoaded()).toBe(false);
    await store.save({ consumerKey: ' key ', consumerSecret: 'secret' });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      CREDENTIALS_STORE_KEY,
      JSON.stringify({ consumerKey: 'key', consumerSecret: 'secret' }),
    );
    const fresh = createCredentialsStore(secureBackend);
    await expect(fresh.load()).resolves.toEqual({ consumerKey: 'key', consumerSecret: 'secret' });
    expect(fresh.get()).toEqual({ consumerKey: 'key', consumerSecret: 'secret' });
    await fresh.clear();
    expect(fresh.get()).toBeNull();
    await expect(createCredentialsStore(secureBackend).load()).resolves.toBeNull();
  });

  it('rejects an empty consumer key', async () => {
    const store = createCredentialsStore(createMemoryBackend());
    await expect(store.save({ consumerKey: ' ' })).rejects.toThrow(/consumer key/);
    expect(store.get()).toBeNull();
  });

  it('discards unreadable stored data', async () => {
    const backend = createMemoryBackend();
    await backend.setItem(CREDENTIALS_STORE_KEY, '{not json');
    await expect(createCredentialsStore(backend).load()).resolves.toBeNull();
    await backend.setItem(CREDENTIALS_STORE_KEY, JSON.stringify({ consumerKey: '' }));
    await expect(createCredentialsStore(backend).load()).resolves.toBeNull();
  });

  it('notifies subscribers and loads once', async () => {
    const backend = createMemoryBackend();
    const getItem = jest.spyOn(backend, 'getItem');
    const store = createCredentialsStore(backend);
    const listener = jest.fn();
    const unsubscribe = store.subscribe(listener);
    await Promise.all([store.load(), store.load()]);
    await store.load();
    expect(getItem).toHaveBeenCalledTimes(1);
    await store.save({ consumerKey: 'k' });
    await store.clear();
    expect(listener).toHaveBeenCalledTimes(3);
    unsubscribe();
    await store.save({ consumerKey: 'k' });
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('keeps a save that finished while loading', async () => {
    const backend = createMemoryBackend();
    await backend.setItem(CREDENTIALS_STORE_KEY, JSON.stringify({ consumerKey: 'old' }));
    const store = createCredentialsStore(backend);
    const loading = store.load();
    await store.save({ consumerKey: 'new' });
    await expect(loading).resolves.toEqual({ consumerKey: 'new' });
  });
});

describe('getEffectiveCredentials', () => {
  const empty = () => createCredentialsStore(createMemoryBackend());

  it('prefers user-entered credentials, never mixing in the env secret', async () => {
    const store = empty();
    await store.save({ consumerKey: 'mine' });
    const e = env({ tumblrApiKey: 'built-in', tumblrClientSecret: 'built-in-secret' });
    expect(getEffectiveCredentials(e, store)).toEqual({ consumerKey: 'mine', source: 'user' });
  });

  it('falls back to the build env', () => {
    expect(
      getEffectiveCredentials(env({ tumblrApiKey: 'k', tumblrClientSecret: 's' }), empty()),
    ).toEqual({ consumerKey: 'k', consumerSecret: 's', source: 'env' });
    expect(getEffectiveCredentials(env({ tumblrApiKey: 'k' }), empty())).toEqual({
      consumerKey: 'k',
      source: 'env',
    });
  });

  it('reports none when nothing is configured (an env secret alone is ignored)', () => {
    const store = empty();
    expect(getEffectiveCredentials(env({ tumblrClientSecret: 's' }), store)).toEqual({
      source: 'none',
    });
    expect(hasApiKey(env(), store)).toBe(false);
    expect(hasApiKey(env({ tumblrApiKey: 'k' }), store)).toBe(true);
  });

  it('uses the seeded test credentials by default', () => {
    expect(credentialsStore.get()).toEqual({ consumerKey: 'test' });
    expect(getEffectiveCredentials()).toEqual({ consumerKey: 'test', source: 'user' });
    expect(hasApiKey()).toBe(true);
  });
});
