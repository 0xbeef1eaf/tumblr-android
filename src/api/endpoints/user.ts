import { apiFetch } from '../client';
import {
  DashboardResponseSchema,
  EmptyResponseSchema,
  FollowingResponseSchema,
  LikesResponseSchema,
  ReblogResponseSchema,
  UserInfoResponseSchema,
  type DashboardResponse,
  type FollowingResponse,
  type LikesResponse,
  type ReblogResponse,
  type UserInfo,
} from '../schemas/user';

import { blogPath } from './blog';

/** `GET /v2/user/info` (OAuth). */
export async function getUserInfo(signal?: AbortSignal): Promise<UserInfo> {
  const response = await apiFetch('/v2/user/info', {
    auth: 'bearer',
    schema: UserInfoResponseSchema,
    signal,
  });
  return response.user;
}

export interface OffsetPage {
  offset?: number;
  limit?: number;
  signal?: AbortSignal;
}

/** `GET /v2/user/dashboard?npf=true&reblog_info=true` (OAuth). */
export function getDashboard({
  offset,
  limit = 20,
  signal,
}: OffsetPage = {}): Promise<DashboardResponse> {
  return apiFetch('/v2/user/dashboard', {
    query: { npf: true, reblog_info: true, limit, offset },
    auth: 'bearer',
    schema: DashboardResponseSchema,
    signal,
  });
}

export interface GetLikesParams {
  /** Unix seconds (`liked_timestamp` of the last item). */
  before?: number;
  limit?: number;
  signal?: AbortSignal;
}

/** `GET /v2/user/likes` (OAuth). */
export function getLikes({
  before,
  limit = 20,
  signal,
}: GetLikesParams = {}): Promise<LikesResponse> {
  return apiFetch('/v2/user/likes', {
    query: { npf: true, limit, before },
    auth: 'bearer',
    schema: LikesResponseSchema,
    signal,
  });
}

/** `GET /v2/user/following` (OAuth). */
export function getFollowing({
  offset,
  limit = 20,
  signal,
}: OffsetPage = {}): Promise<FollowingResponse> {
  return apiFetch('/v2/user/following', {
    query: { limit, offset },
    auth: 'bearer',
    schema: FollowingResponseSchema,
    signal,
  });
}

export interface LikeParams {
  id: string;
  reblog_key: string;
}

async function postAction(path: string, body: Record<string, string>): Promise<void> {
  await apiFetch(path, {
    method: 'POST',
    body,
    bodyType: 'form',
    auth: 'bearer',
    schema: EmptyResponseSchema,
  });
}

/** `POST /v2/user/like` (OAuth). */
export function like({ id, reblog_key }: LikeParams): Promise<void> {
  return postAction('/v2/user/like', { id, reblog_key });
}

/** `POST /v2/user/unlike` (OAuth). */
export function unlike({ id, reblog_key }: LikeParams): Promise<void> {
  return postAction('/v2/user/unlike', { id, reblog_key });
}

/** `POST /v2/user/follow` (OAuth). `url` is a blog URL or name (`name.tumblr.com`). */
export function follow(url: string): Promise<void> {
  return postAction('/v2/user/follow', { url });
}

/** `POST /v2/user/unfollow` (OAuth). */
export function unfollow(url: string): Promise<void> {
  return postAction('/v2/user/unfollow', { url });
}

export interface ReblogParams {
  /** The signed-in user's blog that will host the reblog. */
  blog: string;
  parentTumblelogUuid: string;
  parentPostId: string;
  reblogKey: string;
  comment?: string;
  tags?: string[];
}

/** `POST /v2/blog/{myblog}/posts` NPF reblog (OAuth) → 201. */
export function reblog({
  blog,
  parentTumblelogUuid,
  parentPostId,
  reblogKey,
  comment,
  tags,
}: ReblogParams): Promise<ReblogResponse> {
  const trimmed = comment?.trim();
  return apiFetch(`${blogPath(blog)}/posts`, {
    method: 'POST',
    bodyType: 'json',
    auth: 'bearer',
    schema: ReblogResponseSchema,
    body: {
      parent_tumblelog_uuid: parentTumblelogUuid,
      parent_post_id: parentPostId,
      reblog_key: reblogKey,
      content: trimmed ? [{ type: 'text', text: trimmed }] : [],
      ...(tags && tags.length > 0 ? { tags: tags.join(',') } : {}),
    },
  });
}
