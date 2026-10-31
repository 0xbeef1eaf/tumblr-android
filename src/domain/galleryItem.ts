import { asImageBlock, asVideoBlock, type NpfBlock, type NpfMedia } from '@/api/schemas/npf';
import { isNpfPost, PostSchema, type NpfPost, type Post } from '@/api/schemas/post';
import type { LegacyPhotoPost, LegacySize, LegacyVideoPost } from '@/api/schemas/legacy';
import { createLogger } from '@/lib/log';

import {
  aspectOf,
  detectKind,
  parsePlaceholderColor,
  sortVariants,
  type MediaKind,
  type MediaVariant,
} from './media';
import { htmlToPlain, npfTextToPlain, truncate } from './text';

export type { MediaKind, MediaVariant } from './media';

const logger = createLogger('normalize');

export interface GalleryItem {
  /** `${postId}:${indexInPost}` — one post may yield many items. */
  id: string;
  postId: string;
  blogName: string;
  blogUuid?: string;
  reblogKey: string;
  postUrl: string;
  /** Unix seconds. */
  timestamp: number;
  kind: MediaKind;
  /** Sorted widest → narrowest; for video this is the poster. */
  variants: MediaVariant[];
  /** Native tumblr video only. */
  videoUrl?: string;
  /** Third-party embeds (YouTube…): the watch URL; rendered as a poster image item. */
  embedUrl?: string;
  provider?: string;
  durationMs?: number;
  /** width / height of the original, unclamped. */
  aspectRatio: number;
  altText?: string;
  placeholderColor?: string;
  tags: string[];
  /** Plain text, ≤ 280 chars. */
  summary: string;
  noteCount?: number;
  liked?: boolean;
  isSensitive: boolean;
  indexInPost: number;
  countInPost: number;
}

type MediaDraft = Pick<
  GalleryItem,
  | 'kind'
  | 'variants'
  | 'videoUrl'
  | 'embedUrl'
  | 'provider'
  | 'durationMs'
  | 'aspectRatio'
  | 'altText'
  | 'placeholderColor'
>;

const SUMMARY_MAX = 280;

function toVariants(media: readonly NpfMedia[]): MediaVariant[] {
  return media
    .filter((m) => m.cropped !== true)
    .map((m) => ({ url: m.url, width: m.width ?? 0, height: m.height ?? 0, type: m.type }));
}

function originalAspect(media: readonly NpfMedia[], fallback: MediaVariant[]): number {
  const original = media.find((m) => m.has_original_dimensions) ?? fallback[0];
  return aspectOf(original?.width, original?.height);
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function draftFromNpfBlock(block: NpfBlock): MediaDraft | undefined {
  const image = asImageBlock(block);
  if (image) {
    const raw = toVariants(image.media);
    const aspectRatio = originalAspect(image.media, sortVariants(raw));
    const variants = sortVariants(raw, aspectRatio);
    if (variants.length === 0) return undefined;
    return {
      kind: detectKind(variants),
      variants,
      aspectRatio,
      altText: nonEmpty(image.alt_text),
      placeholderColor: parsePlaceholderColor(image.colors?.c0),
    };
  }
  const video = asVideoBlock(block);
  if (!video) return undefined;
  const poster = sortVariants(toVariants(video.poster ?? []));
  const media = Array.isArray(video.media) ? video.media[0] : video.media;
  const provider = video.provider ?? (media ? 'tumblr' : undefined);
  if (provider === 'tumblr') {
    const videoUrl = media?.url ?? video.url;
    if (!videoUrl) return undefined;
    return {
      kind: 'video',
      variants: poster,
      videoUrl,
      provider,
      durationMs: video.duration,
      aspectRatio: aspectOf(media?.width ?? poster[0]?.width, media?.height ?? poster[0]?.height),
    };
  }
  // Embedded providers: an image item from the poster; the viewer links out via postUrl.
  if (poster.length === 0) return undefined;
  return {
    kind: 'image',
    variants: poster,
    embedUrl: video.url ?? video.embed_url,
    provider,
    aspectRatio: aspectOf(poster[0]?.width, poster[0]?.height),
  };
}

function npfDrafts(post: NpfPost): MediaDraft[] {
  // Reblogs of photosets often carry media only in the trail; trail renders first.
  const sources = [...post.trail.map((t) => t.content), post.content];
  return sources.flatMap((blocks) => blocks.flatMap((b) => draftFromNpfBlock(b) ?? []));
}

function legacySizeVariants(sizes: readonly (LegacySize | undefined)[]): MediaVariant[] {
  return sizes.flatMap((s) => (s ? [{ url: s.url, width: s.width, height: s.height }] : []));
}

function legacyPhotoDrafts(post: LegacyPhotoPost): MediaDraft[] {
  return post.photos.flatMap((photo) => {
    const original = photo.original_size ?? photo.alt_sizes[0];
    const aspectRatio = aspectOf(original?.width, original?.height);
    const variants = sortVariants(
      legacySizeVariants([photo.original_size, ...photo.alt_sizes]),
      aspectRatio,
    );
    if (variants.length === 0) return [];
    return [
      { kind: detectKind(variants), variants, aspectRatio, altText: nonEmpty(photo.caption) },
    ];
  });
}

function legacyVideoDrafts(post: LegacyVideoPost): MediaDraft[] {
  const poster: MediaVariant[] = post.thumbnail_url
    ? [
        {
          url: post.thumbnail_url,
          width: post.thumbnail_width ?? 0,
          height: post.thumbnail_height ?? 0,
        },
      ]
    : [];
  const variants = sortVariants(poster);
  const aspectRatio = aspectOf(post.thumbnail_width, post.thumbnail_height);
  if (post.video_url) {
    return [
      {
        kind: 'video',
        variants,
        videoUrl: post.video_url,
        provider: post.video_type ?? 'tumblr',
        durationMs: post.duration !== undefined ? post.duration * 1000 : undefined,
        aspectRatio,
      },
    ];
  }
  if (variants.length === 0) return [];
  return [
    {
      kind: 'image',
      variants,
      embedUrl: post.permalink_url ?? undefined,
      provider: post.video_type,
      aspectRatio,
    },
  ];
}

export function isSensitivePost(post: Post): boolean {
  const labelled = post.community_labels?.has_community_label === true;
  const classified =
    post.classification !== undefined && !['clean', 'none', ''].includes(post.classification);
  return Boolean(
    post.is_nsfw ||
    post.is_adult ||
    post.blog?.is_adult ||
    post.blog?.is_nsfw ||
    labelled ||
    classified,
  );
}

function summaryOf(post: Post): string {
  let text = nonEmpty(post.summary);
  if (!text && isNpfPost(post)) {
    text = npfTextToPlain(post.content) || npfTextToPlain(post.trail.flatMap((t) => t.content));
  }
  if (!text && !isNpfPost(post)) text = htmlToPlain(post.caption);
  return truncate(text ?? '', SUMMARY_MAX);
}

function draftsOf(post: Post): MediaDraft[] {
  if (isNpfPost(post)) return npfDrafts(post);
  // Casts are safe: the catch-all legacy schema has `type: string`, so TS cannot narrow on
  // the literal, but PostSchema only yields 'photo'/'video' when those schemas matched.
  if (post.type === 'photo') return legacyPhotoDrafts(post as LegacyPhotoPost);
  if (post.type === 'video') return legacyVideoDrafts(post as LegacyVideoPost);
  return [];
}

/**
 * NPF or legacy post → one `GalleryItem` per media item. Text-only posts yield `[]`.
 * Never throws: unexpected shapes are logged and yield `[]`.
 */
export function normalizePost(post: Post): GalleryItem[] {
  try {
    const drafts = draftsOf(post);
    if (drafts.length === 0) return [];
    const base = {
      postId: post.id_string,
      blogName: post.blog_name,
      blogUuid: post.blog?.uuid,
      reblogKey: post.reblog_key,
      postUrl: post.post_url,
      timestamp: post.timestamp,
      tags: post.tags,
      summary: summaryOf(post),
      noteCount: post.note_count,
      liked: post.liked,
      isSensitive: isSensitivePost(post),
      countInPost: drafts.length,
    };
    return drafts.map((draft, index) => ({
      ...base,
      ...draft,
      id: `${post.id_string}:${index}`,
      indexInPost: index,
    }));
  } catch (error) {
    logger.warn('Could not normalise post', error);
    return [];
  }
}

/** Validate an unknown value as a post first; malformed input yields `[]`. */
export function normalizeRawPost(raw: unknown): GalleryItem[] {
  const parsed = PostSchema.safeParse(raw);
  if (!parsed.success) {
    logger.debug('Dropping unparseable post', parsed.error.issues.slice(0, 3));
    return [];
  }
  return normalizePost(parsed.data);
}

/** Normalise a page (or several) of posts, deduplicating items by id. */
export function normalizePosts(posts: readonly Post[]): GalleryItem[] {
  const seen = new Set<string>();
  return posts.flatMap(normalizePost).filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
