import type { GalleryItem } from '@/domain/galleryItem';

/** Minimal `GalleryItem` factory for gallery/viewer tests. */
export function makeItem(overrides: Partial<GalleryItem> & { id: string }): GalleryItem {
  const postId = overrides.postId ?? overrides.id.split(':')[0] ?? overrides.id;
  return {
    postId,
    blogName: 'staff',
    reblogKey: 'rk',
    postUrl: `https://staff.tumblr.com/post/${postId}`,
    timestamp: 1_700_000_000,
    kind: 'image',
    variants: [
      { url: `https://64.media.tumblr.com/${postId}/s1280x1920/a.jpg`, width: 1280, height: 1920 },
      { url: `https://64.media.tumblr.com/${postId}/s640x960/a.jpg`, width: 640, height: 960 },
      { url: `https://64.media.tumblr.com/${postId}/s400x600/a.jpg`, width: 400, height: 600 },
      { url: `https://64.media.tumblr.com/${postId}/s250x400/a.jpg`, width: 250, height: 375 },
    ],
    aspectRatio: 1280 / 1920,
    tags: [],
    summary: 'A caption',
    isSensitive: false,
    indexInPost: 0,
    countInPost: 1,
    ...overrides,
  };
}

export function makeItems(count: number, prefix = 'p'): GalleryItem[] {
  return Array.from({ length: count }, (_, i) => makeItem({ id: `${prefix}${i}:0` }));
}
