import {
  appStorage,
  createKeyValueStore,
  createMemoryStore,
  createStateStorage,
  zustandStorage,
} from './storage';

describe('storage', () => {
  it('memory store implements the KeyValueStore surface', () => {
    const store = createMemoryStore();
    store.set('a', '1');
    store.set('b', '2');
    expect(store.getString('a')).toBe('1');
    expect(store.getAllKeys().sort()).toEqual(['a', 'b']);
    store.remove('a');
    expect(store.getString('a')).toBeUndefined();
    store.clearAll();
    expect(store.getAllKeys()).toEqual([]);
  });

  it('uses an in-memory store under jest', () => {
    const store = createKeyValueStore('x');
    store.set('k', 'v');
    expect(store.getString('k')).toBe('v');
    expect(createKeyValueStore('x').getString('k')).toBeUndefined();
  });

  it('adapts a store to zustand StateStorage', async () => {
    const storage = createStateStorage(createMemoryStore());
    expect(await storage.getItem('missing')).toBeNull();
    await storage.setItem('s', '{"a":1}');
    expect(await storage.getItem('s')).toBe('{"a":1}');
    await storage.removeItem('s');
    expect(await storage.getItem('s')).toBeNull();
  });

  it('the shared zustand adapter writes to appStorage', async () => {
    await zustandStorage.setItem('shared', 'yes');
    expect(appStorage.getString('shared')).toBe('yes');
  });
});
