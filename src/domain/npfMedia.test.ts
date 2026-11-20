import { PostSchema } from '@/api/schemas/post';

import { fx } from './fixtures.testutil';
import { normalizePost } from './galleryItem';
import { isGifVariant } from './media';

const base = 'https://64.media.tumblr.com/abc';
const gif = (w: number) => ({
  type: 'image/gif',
  url: `${base}/s${w}x${w}/a.gif`,
  width: w,
  height: w,
});
const still = (w: number, ext = 'jpg') => ({
  type: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
  url: `${base}/s${w}x${w}/still.${ext}`,
  width: w,
  height: w,
});

/** The dashboard GIF fixture post with its image block replaced. */
function gifPost(block: Record<string, unknown>) {
  return PostSchema.parse({ ...fx.raw.dashboard.response.posts[0], content: [block], trail: [] });
}

describe('GIF media normalisation', () => {
  it('keeps only animated GIF variants and takes the poster from the block', () => {
    const [item] = normalizePost(
      gifPost({
        type: 'image',
        media: [gif(1280), still(1280), gif(540), gif(250), still(400, 'webp')],
        poster: [still(640), still(500), still(250)],
      }),
    );
    expect(item?.kind).toBe('gif');
    expect(item?.variants.map((v) => v.width)).toEqual([1280, 540, 250]);
    expect(item?.variants.every(isGifVariant)).toBe(true);
    // Stills from `poster` and the non-GIF media entries: the narrowest ≥ 540 px.
    expect(item?.posterUrl).toBe(`${base}/s640x640/still.jpg`);
  });

  it('reads a poster nested in a media entry', () => {
    const [item] = normalizePost(
      gifPost({ type: 'image', media: [{ ...gif(500), poster: still(500) }, gif(250)] }),
    );
    expect(item?.variants.map((v) => v.width)).toEqual([500, 250]);
    expect(item?.posterUrl).toBe(`${base}/s500x500/still.jpg`);
  });

  it('has no posterUrl when the block carries no still, and none for plain images', () => {
    const [gifItem] = normalizePost(gifPost({ type: 'image', media: [gif(540), gif(250)] }));
    expect(gifItem?.posterUrl).toBeUndefined();
    const [image] = normalizePost(
      gifPost({ type: 'image', media: [still(640)], poster: [still(250)] }),
    );
    expect(image?.kind).toBe('image');
    expect(image?.posterUrl).toBeUndefined();
  });

  it('keeps the fixture GIF all-GIF', () => {
    const [item] = normalizePost(fx.npfGif);
    expect(item?.variants.length).toBeGreaterThan(0);
    expect(item?.variants.every(isGifVariant)).toBe(true);
  });
});
