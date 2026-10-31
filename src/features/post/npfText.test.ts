import type { NpfFormatting } from '@/api/schemas/npf';

import { buildSegments, resolveLink } from './npfText';

const fmt = (start: number, end: number, type: string, extra: object = {}): NpfFormatting =>
  ({ start, end, type, ...extra }) as NpfFormatting;

describe('buildSegments', () => {
  it('returns a single plain segment without formatting', () => {
    expect(buildSegments('hello', undefined)).toEqual([{ text: 'hello', styles: [] }]);
    expect(buildSegments('', [])).toEqual([]);
  });

  it('splits around a bold range', () => {
    const segments = buildSegments('Four days of rain', [fmt(0, 9, 'bold')]);
    expect(segments.map((s) => [s.text, s.styles])).toEqual([
      ['Four days', ['bold']],
      [' of rain', []],
    ]);
  });

  it('merges overlapping ranges into combined styles', () => {
    const segments = buildSegments('abcdef', [fmt(0, 4, 'bold'), fmt(2, 6, 'italic')]);
    expect(segments.map((s) => [s.text, s.styles])).toEqual([
      ['ab', ['bold']],
      ['cd', ['bold', 'italic']],
      ['ef', ['italic']],
    ]);
  });

  it('resolves tumblr redirect links and keeps mention urls', () => {
    const [segment] = buildSegments('see this', [
      fmt(0, 8, 'link', {
        url: 'https://t.umblr.com/redirect?z=https%3A%2F%2Fexample.com%2Fa&t=x',
      }),
    ]);
    expect(segment).toMatchObject({ styles: ['link'], url: 'https://example.com/a' });
    const [mention] = buildSegments('@staff', [
      fmt(0, 6, 'mention', { url: 'https://staff.tumblr.com', blog: { name: 'staff' } }),
    ]);
    expect(mention).toMatchObject({ styles: ['mention'], url: 'https://staff.tumblr.com' });
  });

  it('counts offsets in code points, not UTF-16 units', () => {
    const segments = buildSegments('😀😀 hi', [fmt(3, 5, 'bold')]);
    expect(segments.map((s) => [s.text, s.styles])).toEqual([
      ['😀😀 ', []],
      ['hi', ['bold']],
    ]);
  });

  it('applies color ranges and ignores unknown or out-of-range formatting', () => {
    const segments = buildSegments('colorful', [
      fmt(0, 5, 'color', { hex: '#ff8a00' }),
      fmt(0, 8, 'sparkle'),
      fmt(50, 60, 'bold'),
      fmt(3, 3, 'bold'),
    ]);
    expect(segments).toEqual([
      { text: 'color', styles: ['color'], url: undefined, color: '#ff8a00' },
      { text: 'ful', styles: [], url: undefined, color: undefined },
    ]);
  });

  it('clamps a range that runs past the end', () => {
    const segments = buildSegments('abc', [fmt(1, 99, 'bold')]);
    expect(segments.map((s) => [s.text, s.styles])).toEqual([
      ['a', []],
      ['bc', ['bold']],
    ]);
  });
});

describe('resolveLink', () => {
  it.each([
    ['https://example.com/x', 'https://example.com/x'],
    ['https://t.umblr.com/redirect?z=https%3A%2F%2Fa.b%2Fc', 'https://a.b/c'],
    ['https://t.umblr.com/redirect', 'https://t.umblr.com/redirect'],
    ['not a url', 'not a url'],
  ])('%s → %s', (input, expected) => {
    expect(resolveLink(input)).toBe(expected);
  });
});
