import { z } from 'zod';

import { LinksSchema } from './envelope';
import { PostListSchema } from './post';
import { lenientArray, looseNumber, opt } from './util';

export const AvatarSchema = z.looseObject({
  width: looseNumber.catch(0),
  height: looseNumber.catch(0),
  url: z.string(),
});
export type Avatar = z.infer<typeof AvatarSchema>;

export const BlogInfoSchema = z.looseObject({
  name: z.string(),
  uuid: opt(z.string()),
  title: opt(z.string()),
  description: opt(z.string()),
  url: opt(z.string()),
  updated: opt(z.number()),
  posts: opt(looseNumber),
  total_posts: opt(looseNumber),
  likes: opt(looseNumber),
  followers: opt(looseNumber),
  avatar: lenientArray(AvatarSchema),
  is_adult: z.boolean().catch(false),
  is_nsfw: z.boolean().catch(false),
  ask: opt(z.boolean()),
  followed: opt(z.boolean()),
  can_be_followed: opt(z.boolean()),
  share_likes: opt(z.boolean()),
  primary: opt(z.boolean()),
  theme: opt(z.looseObject({})),
});
export type BlogInfo = z.infer<typeof BlogInfoSchema>;

export const BlogInfoResponseSchema = z.looseObject({ blog: BlogInfoSchema });
export type BlogInfoResponse = z.infer<typeof BlogInfoResponseSchema>;

export const BlogPostsResponseSchema = z.looseObject({
  blog: opt(BlogInfoSchema),
  posts: PostListSchema,
  total_posts: opt(looseNumber),
  _links: opt(LinksSchema),
});
export type BlogPostsResponse = z.infer<typeof BlogPostsResponseSchema>;

/** `GET /v2/blog/{name}/following`: the blogs a blog publicly follows, most recent first. */
export const BlogFollowingResponseSchema = z.looseObject({
  blogs: lenientArray(BlogInfoSchema),
  total_blogs: looseNumber.catch(0),
  _links: opt(LinksSchema),
});
export type BlogFollowingResponse = z.infer<typeof BlogFollowingResponseSchema>;
