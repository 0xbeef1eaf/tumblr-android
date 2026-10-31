import { z } from 'zod';

import { postCommonShape } from './common';
import { LegacyPostSchema, type LegacyPost } from './legacy';
import { NpfBlockSchema, NpfLayoutSchema, NpfTrailItemSchema } from './npf';
import { lenientArray, opt } from './util';

export const NpfPostSchema = z.looseObject({
  ...postCommonShape,
  type: z.literal('blocks'),
  original_type: opt(z.string()),
  is_blocks_post_format: opt(z.boolean()),
  content: lenientArray(NpfBlockSchema),
  layout: lenientArray(NpfLayoutSchema),
  trail: lenientArray(NpfTrailItemSchema),
});
export type NpfPost = z.infer<typeof NpfPostSchema>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * - A post with a `content` array is NPF even if `type` still carries the legacy name.
 * - `id_string` falls back to `id` (may lose precision above 2^53, hence last resort).
 */
function normaliseRawPost(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  let post = raw;
  if (
    post.id_string === undefined &&
    (typeof post.id === 'number' || typeof post.id === 'string')
  ) {
    post = { ...post, id_string: String(post.id) };
  }
  if (post.type !== 'blocks' && Array.isArray(post.content)) {
    post = { ...post, original_type: post.original_type ?? post.type, type: 'blocks' };
  }
  return post;
}

/** Accepts an NPF or a legacy post; unknown fields pass through untouched. */
export const PostSchema = z.preprocess(
  normaliseRawPost,
  z.union([NpfPostSchema, LegacyPostSchema]),
);
export type Post = NpfPost | LegacyPost;

export function isNpfPost(post: Post): post is NpfPost {
  return post.type === 'blocks';
}

/** Post list that drops (rather than rejects on) individual unparseable posts. */
export const PostListSchema = lenientArray(PostSchema);
