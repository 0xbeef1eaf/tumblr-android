import type { GalleryItem } from '@/domain/galleryItem';
import { appStorage } from '@/lib/storage';

import { BOOKMARKS_STORE_KEY, MAX_BOOKMARKS, useBookmarksStore } from './bookmarksStore';

function item(n: number): GalleryItem {
  return {
    id: `${n}:0`,
    postId: String(n),
    blogName: 'blog',
    reblogKey: 'k',
    postUrl: `https://blog.tumblr.com/post/${n}`,
    timestamp: n,
    kind: 'image',
    variants: [{ url: `https://img/${n}.jpg`, width: 100, height: 100 }],
    aspectRatio: 1,
    tags: [],
    summary: '',
    isSensitive: false,
    indexInPost: 0,
    countInPost: 1,
  };
}

beforeEach(() => useBookmarksStore.getState().clear());

describe('bookmarksStore', () => {
  it('toggles an item on and off, newest first', () => {
    const { toggle, has } = useBookmarksStore.getState();
    expect(toggle(item(1))).toBe(true);
    expect(toggle(item(2))).toBe(true);
    expect(useBookmarksStore.getState().items.map((i) => i.id)).toEqual(['2:0', '1:0']);
    expect(has('1:0')).toBe(true);
    expect(toggle(item(1))).toBe(false);
    expect(useBookmarksStore.getState().has('1:0')).toBe(false);
  });

  it('marks stored items as liked', () => {
    useBookmarksStore.getState().toggle(item(1));
    expect(useBookmarksStore.getState().items[0]?.liked).toBe(true);
  });

  it('removes by id and clears', () => {
    const { toggle, remove, clear } = useBookmarksStore.getState();
    toggle(item(1));
    toggle(item(2));
    remove('1:0');
    expect(useBookmarksStore.getState().items).toHaveLength(1);
    clear();
    expect(useBookmarksStore.getState().items).toEqual([]);
  });

  it('caps the list', () => {
    const { toggle } = useBookmarksStore.getState();
    for (let i = 0; i < MAX_BOOKMARKS + 5; i += 1) toggle(item(i));
    expect(useBookmarksStore.getState().items).toHaveLength(MAX_BOOKMARKS);
    expect(useBookmarksStore.getState().items[0]?.id).toBe(`${MAX_BOOKMARKS + 4}:0`);
  });

  it('persists to storage', () => {
    useBookmarksStore.getState().toggle(item(7));
    const persisted = JSON.parse(appStorage.getString(BOOKMARKS_STORE_KEY) ?? '{}');
    expect(persisted.state.items[0].id).toBe('7:0');
  });
});
