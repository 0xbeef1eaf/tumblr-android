export type MediaKind = 'image' | 'gif' | 'video';

export interface MediaVariant {
  url: string;
  width: number;
  height: number;
  type?: string;
}

/** DESIGN §4: tiles keep their aspect ratio, clamped so one image cannot dominate a column. */
export const ASPECT_MIN = 0.5;
export const ASPECT_MAX = 2;
/** ARCHITECTURE §5.3: GIFs prefer ≤ 540 px in the grid; grid variants ≤ 640 px. */
export const GRID_GIF_MAX_WIDTH = 540;
export const GRID_MAX_WIDTH = 640;

export function clampAspect(ratio: number, min = ASPECT_MIN, max = ASPECT_MAX): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return 1;
  return Math.min(max, Math.max(min, ratio));
}

export function aspectOf(width: number | undefined, height: number | undefined): number {
  if (!width || !height || width <= 0 || height <= 0) return 1;
  return width / height;
}

export function isGifUrl(url: string): boolean {
  return /\.gif(?:[?#]|$)/i.test(url);
}

export function isGifVariant(variant: Pick<MediaVariant, 'url' | 'type'>): boolean {
  return variant.type === 'image/gif' || isGifUrl(variant.url);
}

/** `video` when flagged as video, `gif` if any variant is a GIF, else `image`. */
export function detectKind(
  variants: readonly Pick<MediaVariant, 'url' | 'type'>[],
  options: { isVideo?: boolean } = {},
): MediaKind {
  if (options.isVideo) return 'video';
  return variants.some(isGifVariant) ? 'gif' : 'image';
}

/**
 * Dedupe by URL, drop zero-size entries and crops whose aspect ratio differs from the
 * reference by more than 5 % (e.g. Tumblr's 75×75 squares), then sort widest → narrowest.
 */
export function sortVariants(
  variants: readonly MediaVariant[],
  referenceAspect?: number,
): MediaVariant[] {
  const seen = new Set<string>();
  const valid = variants.filter((v) => {
    if (!v.url || seen.has(v.url) || !(v.width > 0) || !(v.height > 0)) return false;
    seen.add(v.url);
    if (referenceAspect && Number.isFinite(referenceAspect)) {
      const drift = Math.abs(v.width / v.height - referenceAspect) / referenceAspect;
      if (drift > 0.05) return false;
    }
    return true;
  });
  return valid.sort((a, b) => b.width - a.width);
}

export interface PickVariantOptions {
  /** Prefer variants no wider than this (e.g. GIFs in the grid) when any exist. */
  maxWidth?: number;
}

/**
 * Narrowest variant with `width >= targetWidthPx`; if none is wide enough, the widest.
 * Input order does not matter.
 */
export function pickVariant<T extends MediaVariant>(
  variants: readonly T[],
  targetWidthPx: number,
  options: PickVariantOptions = {},
): T | undefined {
  if (variants.length === 0) return undefined;
  let pool = [...variants].sort((a, b) => a.width - b.width);
  const { maxWidth } = options;
  if (maxWidth !== undefined) {
    const capped = pool.filter((v) => v.width <= maxWidth);
    if (capped.length > 0) pool = capped;
  }
  return pool.find((v) => v.width >= targetWidthPx) ?? pool[pool.length - 1];
}

/** Tumblr `colors.c0` (`"abc"` / `"a1b2c3"`, with or without `#`) → `#rrggbb`. */
export function parsePlaceholderColor(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  const hex = value.trim().replace(/^#/, '').toLowerCase();
  if (/^[0-9a-f]{6}$/.test(hex)) return `#${hex}`;
  if (/^[0-9a-f]{3}$/.test(hex)) {
    return `#${hex
      .split('')
      .map((c) => c + c)
      .join('')}`;
  }
  return undefined;
}
