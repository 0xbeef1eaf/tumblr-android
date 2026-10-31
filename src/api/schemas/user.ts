import { z } from 'zod';

import { BlogInfoSchema } from './blog';
import { LinksSchema } from './envelope';
import { PostListSchema } from './post';
import { idString, lenientArray, looseNumber, opt } from './util';

export const UserInfoSchema = z.looseObject({
  name: z.string(),
  likes: opt(looseNumber),
  following: opt(looseNumber),
  default_post_format: opt(z.string()),
  blogs: lenientArray(BlogInfoSchema),
});
export type UserInfo = z.infer<typeof UserInfoSchema>;

export const UserInfoResponseSchema = z.looseObject({ user: UserInfoSchema });

export const DashboardResponseSchema = z.looseObject({
  posts: PostListSchema,
  _links: opt(LinksSchema),
});
export type DashboardResponse = z.infer<typeof DashboardResponseSchema>;

export const LikesResponseSchema = z.looseObject({
  liked_posts: PostListSchema,
  liked_count: looseNumber.catch(0),
  _links: opt(LinksSchema),
});
export type LikesResponse = z.infer<typeof LikesResponseSchema>;

export const FollowingResponseSchema = z.looseObject({
  blogs: lenientArray(BlogInfoSchema),
  total_blogs: looseNumber.catch(0),
  _links: opt(LinksSchema),
});
export type FollowingResponse = z.infer<typeof FollowingResponseSchema>;

/** like/unlike/follow/unfollow return an empty array or object; we only care about success. */
export const EmptyResponseSchema = z.unknown();

export const ReblogResponseSchema = z.looseObject({
  id: opt(z.union([z.number(), z.string()])),
  id_string: opt(idString),
  state: opt(z.string()),
  display_text: opt(z.string()),
});
export type ReblogResponse = z.infer<typeof ReblogResponseSchema>;
