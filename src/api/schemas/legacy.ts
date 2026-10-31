import { z } from 'zod';

import { postCommonShape } from './common';
import { lenientArray, looseNumber, opt } from './util';

export const LegacySizeSchema = z.looseObject({
  url: z.string(),
  width: looseNumber.catch(0),
  height: looseNumber.catch(0),
});
export type LegacySize = z.infer<typeof LegacySizeSchema>;

export const LegacyPhotoSchema = z.looseObject({
  caption: opt(z.string()),
  alt_sizes: lenientArray(LegacySizeSchema),
  original_size: opt(LegacySizeSchema),
});
export type LegacyPhoto = z.infer<typeof LegacyPhotoSchema>;

export const LegacyPhotoPostSchema = z.looseObject({
  ...postCommonShape,
  type: z.literal('photo'),
  photos: lenientArray(LegacyPhotoSchema),
  caption: opt(z.string()),
  photoset_layout: opt(z.string()),
  image_permalink: opt(z.string()),
});
export type LegacyPhotoPost = z.infer<typeof LegacyPhotoPostSchema>;

export const LegacyVideoPostSchema = z.looseObject({
  ...postCommonShape,
  type: z.literal('video'),
  caption: opt(z.string()),
  video_url: opt(z.string()),
  video_type: opt(z.string()),
  thumbnail_url: opt(z.string()),
  thumbnail_width: opt(looseNumber),
  thumbnail_height: opt(looseNumber),
  duration: opt(looseNumber),
  permalink_url: opt(z.string()),
  html5_capable: opt(z.boolean()),
  player: opt(
    lenientArray(
      z.looseObject({
        width: opt(looseNumber),
        embed_code: opt(z.union([z.string(), z.literal(false)])),
      }),
    ),
  ),
});
export type LegacyVideoPost = z.infer<typeof LegacyVideoPostSchema>;

/** text, quote, link, chat, audio, answer… — no gallery media. */
export const LegacyOtherPostSchema = z.looseObject({
  ...postCommonShape,
  type: z.string(),
  title: opt(z.string().nullable()),
  body: opt(z.string()),
  caption: opt(z.string()),
});
export type LegacyOtherPost = z.infer<typeof LegacyOtherPostSchema>;

export const LegacyPostSchema = z.union([
  LegacyPhotoPostSchema,
  LegacyVideoPostSchema,
  LegacyOtherPostSchema,
]);
export type LegacyPost = z.infer<typeof LegacyPostSchema>;
