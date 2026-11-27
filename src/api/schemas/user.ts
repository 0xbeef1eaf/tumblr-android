import { z } from 'zod';

import { BlogInfoSchema } from './blog';
import { LinksSchema, type Links } from './envelope';
import { PostListSchema, type Post } from './post';
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Timeline elements can be posts or other objects (carousels, titles…); keep posts only. */
export function isPostElement(value: unknown): boolean {
  return isRecord(value) && (value.object_type === undefined || value.object_type === 'post');
}

/** Cursor of the next For You page: `query_params.cursor`, else `cursor=` in `href`. */
export function forYouCursor(links: Links | undefined): string | undefined {
  const next = links?.next;
  if (!next) return undefined;
  const param = next.query_params?.cursor;
  if (param !== undefined && String(param) !== '') return String(param);
  const match = /[?&]cursor=([^&#]+)/.exec(next.href);
  if (!match?.[1]) return undefined;
  try {
    return decodeURIComponent(match[1].replace(/\+/g, ' '));
  } catch {
    return match[1];
  }
}

export interface ForYouPage {
  posts: Post[];
  /** Timeline elements before filtering (posts plus carousels, ads…). */
  elementCount: number;
  nextCursor?: string;
}

/**
 * `GET /v2/tabs/for_you` — undocumented (used by Tumblr's own clients). Tolerant on
 * purpose: unknown fields pass through, non-post elements are dropped, a missing timeline
 * is an empty page.
 */
export const ForYouResponseSchema = z
  .looseObject({
    timeline: z
      .looseObject({
        elements: z.array(z.unknown()).catch([]),
        _links: opt(LinksSchema),
      })
      .catch({ elements: [] }),
  })
  .transform(({ timeline }): ForYouPage => ({
    posts: PostListSchema.parse(timeline.elements.filter(isPostElement)),
    elementCount: timeline.elements.length,
    nextCursor: forYouCursor(timeline._links),
  }));
