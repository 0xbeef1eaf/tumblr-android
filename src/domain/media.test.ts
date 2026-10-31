import {
  clampAspect,
  detectKind,
  isGifUrl,
  parsePlaceholderColor,
  pickVariant,
  sortVariants,
  type MediaVariant,
} from './media';

const v = (width: number, ext = 'jpg', type?: string): MediaVariant => ({
  url: `https://64.media.tumblr.com/abc/tumblr_x_${width}.${ext}`,
  width,
  height: Math.round(width * 1.5),
  type,
});
const ladder = [1280, 640, 540, 500, 400, 250, 100].map((w) => v(w));

describe('pickVariant', () => {
  it.each([
    [100, 100],
    [101, 250],
    [300, 400],
    [540, 540],
    [541, 640],
    [1080, 1280],
    [4000, 1280],
    [0, 100],
  ])('target %ipx → %ipx', (target, expected) => {
    expect(pickVariant(ladder, target)?.width).toBe(expected);
  });

  it('does not depend on input order', () => {
    expect(pickVariant([...ladder].reverse(), 300)?.width).toBe(400);
  });

  it('returns undefined for no variants', () => {
    expect(pickVariant([], 300)).toBeUndefined();
  });

  it.each([
    [300, 400],
    [700, 540],
  ])('caps GIFs with maxWidth (target %i → %i)', (target, expected) => {
    expect(pickVariant(ladder, target, { maxWidth: 540 })?.width).toBe(expected);
  });

  it('ignores maxWidth when nothing fits under it', () => {
    expect(pickVariant([v(1280)], 300, { maxWidth: 100 })?.width).toBe(1280);
  });
});

describe('clampAspect', () => {
  it.each([
    [1, 1],
    [0.2, 0.5],
    [3, 2],
    [0.75, 0.75],
    [0, 1],
    [Number.NaN, 1],
    [Number.POSITIVE_INFINITY, 1],
    [-2, 1],
  ])('%p → %p', (input, expected) => {
    expect(clampAspect(input)).toBe(expected);
  });
});

describe('detectKind / isGifUrl', () => {
  it.each([
    [[v(500)], {}, 'image'],
    [[v(500, 'gif')], {}, 'gif'],
    [[v(500, 'jpg', 'image/gif')], {}, 'gif'],
    [[v(500, 'gif')], { isVideo: true }, 'video'],
    [[], {}, 'image'],
  ] as const)('%#', (variants, options, expected) => {
    expect(detectKind(variants, options)).toBe(expected);
  });

  it.each([
    ['https://x/a.gif', true],
    ['https://x/a.GIF?w=1', true],
    ['https://x/a.gifv', false],
    ['https://x/gif.jpg', false],
  ])('%s → %p', (url, expected) => expect(isGifUrl(url)).toBe(expected));
});

describe('sortVariants', () => {
  it('sorts widest first, dedupes, drops empty sizes and off-aspect crops', () => {
    const square = { url: 'https://x/sq.jpg', width: 75, height: 75 };
    const zero = { url: 'https://x/zero.jpg', width: 0, height: 0 };
    const sorted = sortVariants([v(250), v(1280), v(250), square, zero, v(640)], 1280 / 1920);
    expect(sorted.map((s) => s.width)).toEqual([1280, 640, 250]);
  });
});

describe('parsePlaceholderColor', () => {
  it.each([
    ['a1b2c3', '#a1b2c3'],
    ['A1B2C3', '#a1b2c3'],
    ['#a1b2c3', '#a1b2c3'],
    ['abc', '#aabbcc'],
    ['#FfF', '#ffffff'],
    ['', undefined],
    [undefined, undefined],
    ['abcd', undefined],
    ['zzzzzz', undefined],
  ])('%p → %p', (input, expected) => {
    expect(parsePlaceholderColor(input)).toBe(expected);
  });
});
