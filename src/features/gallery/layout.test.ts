import { makeItem } from './items.testutil';
import {
  columnWidthDp,
  columnWidthPx,
  distributeColumns,
  filterByKind,
  formatDuration,
  gridVariant,
  pickAnimatingGifs,
  skeletonAspects,
  tileAccessibilityLabel,
  tileBadges,
  tileHeight,
} from './layout';

describe('gallery layout', () => {
  it('computes column widths with 8dp margins and 4dp gutters', () => {
    expect(columnWidthDp(400, 2)).toBe((400 - 16 - 4) / 2);
    expect(columnWidthDp(400, 3)).toBeCloseTo((400 - 16 - 8) / 3);
    expect(columnWidthPx(400, 2, 3)).toBe(570);
  });

  it('clamps tile aspect ratios to [0.5, 2]', () => {
    expect(tileHeight({ aspectRatio: 0.1 }, 100)).toBe(200);
    expect(tileHeight({ aspectRatio: 10 }, 100)).toBe(50);
    expect(tileHeight({ aspectRatio: 1 }, 100)).toBe(100);
  });

  it('picks the grid variant via pickVariant, capping GIFs at 540px', () => {
    const image = makeItem({ id: 'a:0' });
    expect(gridVariant(image, 380)?.width).toBe(400);
    expect(gridVariant(image, 2000)?.width).toBe(640);
    const gif = makeItem({
      id: 'g:0',
      kind: 'gif',
      variants: [
        { url: 'https://x/1280.gif', width: 1280, height: 720 },
        { url: 'https://x/540.gif', width: 540, height: 304 },
        { url: 'https://x/400.gif', width: 400, height: 225 },
      ],
    });
    expect(gridVariant(gif, 600)?.width).toBe(540);
  });

  it('filters by kind', () => {
    const items = [
      makeItem({ id: 'a:0' }),
      makeItem({ id: 'b:0', kind: 'gif' }),
      makeItem({ id: 'c:0', kind: 'video' }),
    ];
    expect(filterByKind(items, 'all')).toBe(items);
    expect(filterByKind(items, 'gif').map((i) => i.id)).toEqual(['b:0']);
  });

  it('formats durations', () => {
    expect(formatDuration(12_000)).toBe('0:12');
    expect(formatDuration(75_400)).toBe('1:15');
    expect(formatDuration(3_725_000)).toBe('1:02:05');
    expect(formatDuration(undefined)).toBeUndefined();
  });

  it('builds badges and accessibility labels', () => {
    expect(tileBadges(makeItem({ id: 'a:0' }))).toEqual([]);
    expect(tileBadges(makeItem({ id: 'a:0', kind: 'gif' })).map((b) => b.label)).toEqual(['GIF']);
    expect(
      tileBadges(makeItem({ id: 'a:1', kind: 'video', durationMs: 12_000 })).map((b) => b.label),
    ).toEqual(['▶ 0:12']);
    expect(
      tileBadges(makeItem({ id: 'a:1', indexInPost: 1, countInPost: 4 })).map((b) => b.label),
    ).toEqual(['2/4']);
    expect(tileAccessibilityLabel({ altText: 'A cat', blogName: 'b' })).toBe('A cat');
    expect(tileAccessibilityLabel({ blogName: 'b' })).toBe('Image from b');
  });

  it('produces stable skeleton aspects and balanced columns', () => {
    const a = skeletonAspects(12);
    expect(a).toEqual(skeletonAspects(12));
    expect(a.every((x) => x >= 0.6 && x <= 1.6)).toBe(true);
    const cols = distributeColumns([1, 1, 1, 1, 1, 1], 3, (x) => x);
    expect(cols.map((c) => c.length)).toEqual([2, 2, 2]);
  });

  it('lets at most 6 visible GIFs animate', () => {
    const visible = [
      makeItem({ id: 'i:0' }),
      ...Array.from({ length: 8 }, (_, i) => makeItem({ id: `g${i}:0`, kind: 'gif' })),
    ];
    const ids = pickAnimatingGifs(visible);
    expect(ids.size).toBe(6);
    expect(ids.has('i:0')).toBe(false);
    expect(ids.has('g6:0')).toBe(false);
  });
});
