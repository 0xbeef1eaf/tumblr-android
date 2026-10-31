import { appStorage } from '@/lib/storage';

import { MAX_HISTORY, SEARCH_HISTORY_KEY, useSearchHistoryStore } from './searchHistoryStore';

const store = () => useSearchHistoryStore.getState();
const values = () => store().entries.map((e) => `${e.type}:${e.value}`);

beforeEach(() => {
  store().clear();
  jest.restoreAllMocks();
});

describe('searchHistoryStore', () => {
  it('adds newest first with a timestamp', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1234);
    store().add('tag', 'cats');
    store().add('blog', 'staff');
    expect(values()).toEqual(['blog:staff', 'tag:cats']);
    expect(store().entries[0]?.at).toBe(1234);
  });

  it('dedupes by type and case-insensitive value, moving the entry to the front', () => {
    store().add('tag', 'Cats');
    store().add('tag', 'space');
    store().add('tag', 'cats');
    expect(values()).toEqual(['tag:cats', 'tag:space']);
  });

  it('keeps a tag and a blog with the same value apart', () => {
    store().add('tag', 'staff');
    store().add('blog', 'staff');
    expect(values()).toEqual(['blog:staff', 'tag:staff']);
  });

  it('ignores blank values and trims', () => {
    store().add('tag', '   ');
    store().add('tag', '  cats ');
    expect(values()).toEqual(['tag:cats']);
  });

  it('keeps at most 20 entries, dropping the oldest', () => {
    for (let i = 0; i < MAX_HISTORY + 5; i++) store().add('tag', `t${i}`);
    expect(store().entries).toHaveLength(MAX_HISTORY);
    expect(store().entries[0]?.value).toBe(`t${MAX_HISTORY + 4}`);
    expect(values()).not.toContain('tag:t0');
  });

  it('removes one entry and clears all', () => {
    store().add('tag', 'a');
    store().add('blog', 'b');
    store().remove('tag', 'A');
    expect(values()).toEqual(['blog:b']);
    store().clear();
    expect(store().entries).toEqual([]);
  });

  it('persists only the entries to storage', () => {
    store().add('tag', 'cats');
    const persisted = JSON.parse(appStorage.getString(SEARCH_HISTORY_KEY) ?? '{}');
    expect(Object.keys(persisted.state)).toEqual(['entries']);
    expect(persisted.state.entries[0]).toMatchObject({ type: 'tag', value: 'cats' });
  });

  it('rehydrates from storage', async () => {
    appStorage.set(
      SEARCH_HISTORY_KEY,
      JSON.stringify({
        state: { entries: [{ type: 'blog', value: 'staff', at: 5 }] },
        version: 1,
      }),
    );
    await useSearchHistoryStore.persist.rehydrate();
    expect(values()).toEqual(['blog:staff']);
  });
});
