import { PostSchema, type Post } from '@/api/schemas/post';

import { fx } from './fixtures.testutil';
import { normalizePost, normalizePosts, normalizeRawPost, type GalleryItem } from './galleryItem';

interface Case {
  name: string;
  post: Post;
  count: number;
  kinds: GalleryItem['kind'][];
  check?: (items: GalleryItem[]) => void;
}

const cases: Case[] = [
  {
    name: 'NPF single image',
    post: fx.npfSingleImage,
    count: 1,
    kinds: ['image'],
    check: ([item]) => {
      expect(item?.altText).toBe('Fog rolling over a lava field at dawn');
      expect(item?.aspectRatio).toBeCloseTo(1280 / 1920);
      expect(item?.variants[0]?.width).toBe(1280);
      expect(item?.variants.some((v) => v.width === 75)).toBe(false); // cropped square dropped
      expect(item?.summary).toBe('Dawn at Þingvellir.');
    },
  },
  {
    name: 'NPF photoset with rows layout',
    post: fx.npfPhotosetRows,
    count: 4,
    kinds: ['image', 'image', 'image', 'image'],
    check: (items) => {
      expect(items.map((i) => i.indexInPost)).toEqual([0, 1, 2, 3]);
      expect(items.every((i) => i.countInPost === 4)).toBe(true);
      expect(new Set(items.map((i) => i.id)).size).toBe(4);
    },
  },
  {
    name: 'NPF reblog whose media is only in the trail',
    post: fx.npfReblogTrailOnly,
    count: 2,
    kinds: ['image', 'gif'],
    check: ([first]) => {
      expect(first?.blogName).toBe('northlight-studio');
      expect(first?.altText).toBe('Matterhorn at sunrise');
      expect(first?.summary).toBe('Zermatt, 5:40am');
    },
  },
  {
    name: 'NPF native video',
    post: fx.npfNativeVideo,
    count: 1,
    kinds: ['video'],
    check: ([item]) => {
      expect(item?.videoUrl).toMatch(/^https:\/\/va\.media\.tumblr\.com\/tumblr_.+\.mp4$/);
      expect(item?.variants[0]?.url).toMatch(/_frame1\.jpg$/);
      expect(item?.durationMs).toBe(12500);
      expect(item?.aspectRatio).toBeCloseTo(720 / 1280);
    },
  },
  {
    name: 'NPF youtube video → poster item without videoUrl',
    post: fx.npfYoutube,
    count: 1,
    kinds: ['image'],
    check: ([item]) => {
      expect(item?.videoUrl).toBeUndefined();
      expect(item?.provider).toBe('youtube');
      expect(item?.embedUrl).toContain('youtube.com');
      expect(item?.variants[0]?.url).toContain('i.ytimg.com');
    },
  },
  {
    name: 'legacy photo',
    post: fx.legacyPhoto,
    count: 1,
    kinds: ['image'],
    check: ([item]) => {
      expect(item?.variants.map((v) => v.width)).toEqual([1280, 640, 540, 500, 400, 250, 100]);
      expect(item?.summary).toBe('Morning fog over Þingvellir');
      expect(item?.placeholderColor).toBeUndefined();
    },
  },
  {
    name: 'legacy photoset (with a GIF)',
    post: fx.legacyPhotoset,
    count: 3,
    kinds: ['image', 'image', 'gif'],
  },
  {
    name: 'legacy video',
    post: fx.legacyVideo,
    count: 1,
    kinds: ['video'],
    check: ([item]) => {
      expect(item?.videoUrl).toMatch(/\.mp4$/);
      expect(item?.durationMs).toBe(14_000);
      expect(item?.variants[0]?.url).toMatch(/_frame1\.jpg$/);
    },
  },
  {
    name: 'legacy youtube video → poster item',
    post: fx.legacyYoutube,
    count: 1,
    kinds: ['image'],
    check: ([item]) => expect(item?.videoUrl).toBeUndefined(),
  },
  { name: 'NPF text post', post: fx.npfTextOnly, count: 0, kinds: [] },
  { name: 'legacy text post', post: fx.legacyText, count: 0, kinds: [] },
  {
    name: 'NPF GIF',
    post: fx.npfGif,
    count: 1,
    kinds: ['gif'],
    check: ([item]) => expect(item?.placeholderColor).toBe('#ccbbaa'),
  },
];

describe('normalizePost', () => {
  it.each(cases)('$name', ({ post, count, kinds, check }) => {
    const items = normalizePost(post);
    expect(items).toHaveLength(count);
    expect(items.map((i) => i.kind)).toEqual(kinds);
    for (const item of items) {
      expect(item.postId).toBe(post.id_string);
      expect(item.id).toBe(`${post.id_string}:${item.indexInPost}`);
      expect(item.reblogKey).toBe(post.reblog_key);
      expect(item.summary.length).toBeLessThanOrEqual(280);
    }
    check?.(items);
  });

  it.each([
    ['NPF placeholder from 6-hex c0', fx.npfSingleImage, '#a1b2c3'],
    ['NPF placeholder from 3-hex c0', fx.npfPhotosetRows, '#aabbcc'],
  ])('%s', (_name, post, colour) => {
    expect(normalizePost(post)[0]?.placeholderColor).toBe(colour);
  });

  it.each([
    ['adult blog', fx.npfAdultBlog, true],
    ['community label', fx.npfCommunityLabel, true],
    ['ordinary post', fx.npfSingleImage, false],
    ['legacy post without flags', fx.legacyPhoto, false],
  ])('sensitive flag: %s', (_name, post, expected) => {
    expect(normalizePost(post)[0]?.isSensitive).toBe(expected);
  });

  it('treats is_nsfw on a legacy post as sensitive', () => {
    const post = PostSchema.parse({ ...fx.legacyPhoto, is_nsfw: true });
    expect(normalizePost(post)[0]?.isSensitive).toBe(true);
  });

  it('keeps 64-bit ids as strings', () => {
    const [item] = normalizePost(fx.npfSingleImage);
    expect(typeof item?.postId).toBe('string');
    expect(item?.postId).toBe(fx.raw.blogPosts.response.posts[0]?.id_string);
  });

  it.each([
    ['null', null],
    ['a string', 'post'],
    ['an empty object', {}],
    ['content that is not an array', { type: 'blocks', content: 'nope', blog_name: 42 }],
    ['photos that are not an array', { type: 'photo', id_string: '1', blog_name: 'x', photos: 3 }],
  ])('malformed post (%s) → [] without throwing', (_name, raw) => {
    expect(() => normalizeRawPost(raw)).not.toThrow();
    expect(normalizeRawPost(raw)).toEqual([]);
    // Even an unvalidated object cast to Post must not throw.
    expect(normalizePost(raw as unknown as Post)).toEqual([]);
  });

  it('normalises raw fixture posts the same way as parsed ones', () => {
    const raw = fx.raw.blogPosts.response.posts[1];
    expect(normalizeRawPost(raw)).toEqual(normalizePost(fx.npfPhotosetRows));
  });
});

describe('normalizePosts', () => {
  it('flattens pages, drops text posts and dedupes overlapping pages', () => {
    const page = fx.lists.npf;
    const items = normalizePosts([...page, ...page]);
    expect(items).toHaveLength(1 + 4 + 1 + 1 + 2);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
  });

  it('handles a mixed legacy/NPF likes page', () => {
    const items = normalizePosts(fx.lists.liked);
    expect(items.map((i) => i.blogName)).toEqual(['archiform', 'grainandlight']);
  });
});
