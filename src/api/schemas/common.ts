import { z } from 'zod';

import { NpfBlogRefSchema } from './npf';
import { idString, lenientArray, looseNumber, opt } from './util';

/** Fields shared by NPF and legacy posts. Everything except identity is optional. */
export const postCommonShape = {
  object_type: opt(z.string()),
  id_string: idString,
  blog_name: z.string(),
  blog: opt(NpfBlogRefSchema),
  reblog_key: z.string().catch(''),
  post_url: z.string().catch(''),
  short_url: opt(z.string()),
  slug: opt(z.string()),
  timestamp: looseNumber.catch(0),
  date: opt(z.string()),
  liked_timestamp: opt(z.number()),
  featured_timestamp: opt(z.number().nullable()),
  tags: lenientArray(z.string()),
  summary: opt(z.string()),
  note_count: opt(looseNumber),
  liked: opt(z.boolean()),
  followed: opt(z.boolean()),
  can_like: opt(z.boolean()),
  can_reblog: opt(z.boolean()),
  is_nsfw: opt(z.boolean()),
  is_adult: opt(z.boolean()),
  classification: opt(z.string()),
  community_labels: opt(
    z.looseObject({
      has_community_label: opt(z.boolean()),
      categories: opt(lenientArray(z.string())),
    }),
  ),
  reblogged_from_name: opt(z.string()),
  reblogged_root_name: opt(z.string()),
  parent_post_url: opt(z.string()),
} as const;
