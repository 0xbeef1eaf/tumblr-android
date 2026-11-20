import { PixelRatio } from 'react-native';

import type { GalleryItem, MediaKind } from '@/domain/galleryItem';
import {
  clampAspect,
  GRID_GIF_MAX_WIDTH,
  GRID_MAX_WIDTH,
  isGifVariant,
  pickVariant,
} from '@/domain/media';
import { layout } from '@/ui/theme';

export type KindFilter = 'all' | MediaKind;

/** At most this many GIFs animate at once (ARCHITECTURE §8). */
export const MAX_ANIMATING_GIFS = 10;
export const SKELETON_TILE_COUNT = 12;
export const FOOTER_SKELETON_COUNT = 3;

export function filterByKind(items: GalleryItem[], kind: KindFilter = 'all'): GalleryItem[] {
  return kind === 'all' ? items : items.filter((item) => item.kind === kind);
}

/** Column width in dp for a masonry grid with 4 dp gutters and 8 dp outer margins. */
export function columnWidthDp(windowWidth: number, columns: number): number {
  const cols = Math.max(1, columns);
  const inner = windowWidth - 2 * layout.outerMargin - (cols - 1) * layout.gutter;
  return Math.max(1, inner / cols);
}

/** ARCHITECTURE §5.3: grid target = columnWidthDp × pixel ratio. */
export function columnWidthPx(windowWidth: number, columns: number, ratio = PixelRatio.get()) {
  return Math.round(columnWidthDp(windowWidth, columns) * ratio);
}

/** Variants an item may display: a GIF never falls back to a still (that is `posterUrl`). */
export function displayVariants(item: Pick<GalleryItem, 'kind' | 'variants'>) {
  return item.kind === 'gif' ? item.variants.filter(isGifVariant) : item.variants;
}

/**
 * The variant a grid tile shows; the viewer reuses it as its (cached) placeholder. GIFs:
 * the narrowest `.gif` ≥ the column among those ≤ GRID_GIF_MAX_WIDTH, else the largest of them.
 */
export function gridVariant(item: Pick<GalleryItem, 'kind' | 'variants'>, widthPx: number) {
  return pickVariant(displayVariants(item), widthPx, {
    maxWidth: item.kind === 'gif' ? GRID_GIF_MAX_WIDTH : GRID_MAX_WIDTH,
  });
}

/** Tile height for a column width, using the clamped aspect ratio (DESIGN §4). */
export function tileHeight(item: Pick<GalleryItem, 'aspectRatio'>, width: number): number {
  return width / clampAspect(item.aspectRatio);
}

/** Deterministic pseudo-random aspect ratios in [0.6, 1.6] so skeletons do not jump. */
export function skeletonAspects(count: number, seed = 7): number[] {
  const out: number[] = [];
  let x = seed;
  for (let i = 0; i < count; i += 1) {
    x = (x * 9301 + 49297) % 233280;
    out.push(Math.round((0.6 + (x / 233280) * 1.0) * 100) / 100);
  }
  return out;
}

/** Split items into `columns` buckets, each time appending to the shortest column. */
export function distributeColumns<T>(
  entries: readonly T[],
  columns: number,
  heightOf: (entry: T) => number,
): T[][] {
  const cols: T[][] = Array.from({ length: Math.max(1, columns) }, () => []);
  const heights = cols.map(() => 0);
  for (const entry of entries) {
    let target = 0;
    for (let c = 1; c < heights.length; c += 1) {
      if ((heights[c] ?? 0) < (heights[target] ?? 0)) target = c;
    }
    cols[target]?.push(entry);
    heights[target] = (heights[target] ?? 0) + heightOf(entry);
  }
  return cols;
}

/** `75000` → `"1:15"`, `3_725_000` → `"1:02:05"`. */
export function formatDuration(ms: number | undefined): string | undefined {
  if (ms === undefined || !Number.isFinite(ms) || ms < 0) return undefined;
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

export interface TileBadge {
  key: 'gif' | 'video' | 'set';
  label: string;
  accessibilityLabel: string;
}

export function tileBadges(item: GalleryItem): TileBadge[] {
  const badges: TileBadge[] = [];
  if (item.kind === 'gif') badges.push({ key: 'gif', label: 'GIF', accessibilityLabel: 'GIF' });
  if (item.kind === 'video') {
    const duration = formatDuration(item.durationMs);
    badges.push({
      key: 'video',
      label: duration ? `▶ ${duration}` : '▶',
      accessibilityLabel: duration ? `Video, ${duration}` : 'Video',
    });
  }
  if (item.countInPost > 1) {
    const label = `${item.indexInPost + 1}/${item.countInPost}`;
    badges.push({
      key: 'set',
      label,
      accessibilityLabel: `${item.indexInPost + 1} of ${item.countInPost}`,
    });
  }
  return badges;
}

export function tileAccessibilityLabel(item: Pick<GalleryItem, 'altText' | 'blogName'>): string {
  return item.altText ?? `Image from ${item.blogName}`;
}

/**
 * Of the currently visible items, the ids of the GIFs allowed to animate: the first
 * `max` in visible order.
 */
export function pickAnimatingGifs(
  visible: readonly Pick<GalleryItem, 'id' | 'kind'>[],
  max = MAX_ANIMATING_GIFS,
): Set<string> {
  const ids = new Set<string>();
  for (const item of visible) {
    if (ids.size >= max) break;
    if (item.kind === 'gif') ids.add(item.id);
  }
  return ids;
}
