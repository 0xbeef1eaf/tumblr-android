import { z } from 'zod';

import { idString, lenientArray, looseNumber, opt } from './util';

/** A single media object (image variant, video file, poster). */
export const NpfMediaSchema = z.looseObject({
  url: z.string(),
  type: opt(z.string()),
  width: opt(looseNumber),
  height: opt(looseNumber),
  original_dimensions_missing: opt(z.boolean()),
  has_original_dimensions: opt(z.boolean()),
  cropped: opt(z.boolean()),
});
export type NpfMedia = z.infer<typeof NpfMediaSchema>;

export const NpfBlogRefSchema = z.looseObject({
  name: z.string(),
  uuid: opt(z.string()),
  url: opt(z.string()),
  title: opt(z.string()),
  is_adult: opt(z.boolean()),
  is_nsfw: opt(z.boolean()),
});
export type NpfBlogRef = z.infer<typeof NpfBlogRefSchema>;

export const NpfImageBlockSchema = z.looseObject({
  type: z.literal('image'),
  media: lenientArray(NpfMediaSchema),
  alt_text: opt(z.string()),
  caption: opt(z.string()),
  colors: opt(z.record(z.string(), z.string())),
  poster: opt(lenientArray(NpfMediaSchema)),
  feedback_token: opt(z.string()),
});
export type NpfImageBlock = z.infer<typeof NpfImageBlockSchema>;

export const NpfVideoBlockSchema = z.looseObject({
  type: z.literal('video'),
  provider: opt(z.string()),
  url: opt(z.string()),
  // Native tumblr video: a single media object. Some responses use an array; accept both.
  media: opt(z.union([NpfMediaSchema, z.array(NpfMediaSchema)])),
  poster: opt(lenientArray(NpfMediaSchema)),
  embed_html: opt(z.string()),
  embed_url: opt(z.string()),
  duration: opt(looseNumber),
  can_autoplay_on_cellular: opt(z.boolean()),
});
export type NpfVideoBlock = z.infer<typeof NpfVideoBlockSchema>;

export const NpfFormattingSchema = z.looseObject({
  start: z.number(),
  end: z.number(),
  type: z.string(),
  url: opt(z.string()),
  blog: opt(z.looseObject({ name: opt(z.string()), uuid: opt(z.string()) })),
  hex: opt(z.string()),
});
export type NpfFormatting = z.infer<typeof NpfFormattingSchema>;

export const NpfTextBlockSchema = z.looseObject({
  type: z.literal('text'),
  text: z.string().catch(''),
  subtype: opt(z.string()),
  indent_level: opt(z.number()),
  formatting: opt(lenientArray(NpfFormattingSchema)),
});
export type NpfTextBlock = z.infer<typeof NpfTextBlockSchema>;

/** Any block. Known block types are narrowed with the `as*Block` helpers below. */
export const NpfBlockSchema = z.looseObject({ type: z.string() });
export type NpfBlock = z.infer<typeof NpfBlockSchema>;

export const NpfLayoutSchema = z.looseObject({
  type: z.string(),
  display: opt(lenientArray(z.looseObject({ blocks: lenientArray(z.number()) }))),
  truncate_after: opt(z.number()),
  blocks: opt(lenientArray(z.number())),
});
export type NpfLayout = z.infer<typeof NpfLayoutSchema>;

export const NpfTrailItemSchema = z.looseObject({
  post: opt(z.looseObject({ id: opt(idString), timestamp: opt(z.number()) })),
  blog: opt(NpfBlogRefSchema),
  broken_blog_name: opt(z.string()),
  content: lenientArray(NpfBlockSchema),
  layout: lenientArray(NpfLayoutSchema),
});
export type NpfTrailItem = z.infer<typeof NpfTrailItemSchema>;

export function asImageBlock(block: NpfBlock): NpfImageBlock | undefined {
  if (block.type !== 'image') return undefined;
  const parsed = NpfImageBlockSchema.safeParse(block);
  return parsed.success ? parsed.data : undefined;
}

export function asVideoBlock(block: NpfBlock): NpfVideoBlock | undefined {
  if (block.type !== 'video') return undefined;
  const parsed = NpfVideoBlockSchema.safeParse(block);
  return parsed.success ? parsed.data : undefined;
}

export function asTextBlock(block: NpfBlock): NpfTextBlock | undefined {
  if (block.type !== 'text') return undefined;
  const parsed = NpfTextBlockSchema.safeParse(block);
  return parsed.success ? parsed.data : undefined;
}
