import type { NpfImageBlock, NpfMedia, NpfStill } from '@/api/schemas/npf';

import {
  GRID_GIF_MAX_WIDTH,
  isGifVariant,
  pickVariant,
  sortVariants,
  type MediaVariant,
} from './media';

/** NPF media → variants, skipping Tumblr's cropped squares. */
export function toVariants(media: readonly NpfStill[]): MediaVariant[] {
  return media
    .filter((m) => m.cropped !== true)
    .map((m) => ({ url: m.url, width: m.width ?? 0, height: m.height ?? 0, type: m.type }));
}

/** Still frames of a GIF block: block `poster`, each media entry's `poster`, non-GIF media. */
function gifStills(image: NpfImageBlock): MediaVariant[] {
  const nested = image.media.flatMap((m: NpfMedia) =>
    m.poster === undefined ? [] : Array.isArray(m.poster) ? m.poster : [m.poster],
  );
  return toVariants([...(image.poster ?? []), ...nested, ...image.media]).filter(
    (v) => !isGifVariant(v),
  );
}

/** A GIF keeps only animated variants; its stills give `posterUrl` (≈ grid width). */
export function gifMedia(image: NpfImageBlock, variants: MediaVariant[], aspectRatio: number) {
  const stills = gifStills(image);
  const sized = sortVariants(stills, aspectRatio);
  const poster = pickVariant(sized, GRID_GIF_MAX_WIDTH)?.url ?? stills[0]?.url;
  return { variants: variants.filter(isGifVariant), ...(poster ? { posterUrl: poster } : {}) };
}
