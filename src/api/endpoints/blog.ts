import { API_BASE_URL, apiFetch } from '../client';
import {
  BlogInfoResponseSchema,
  BlogPostsResponseSchema,
  type BlogInfo,
  type BlogPostsResponse,
} from '../schemas/blog';

/** Accepts `name`, `name.tumblr.com` or a blog uuid. */
export function blogPath(name: string): string {
  return `/v2/blog/${encodeURIComponent(name.trim())}`;
}

/** `GET /v2/blog/{name}/info` (API key). */
export async function getBlogInfo(name: string, signal?: AbortSignal): Promise<BlogInfo> {
  const response = await apiFetch(`${blogPath(name)}/info`, {
    auth: 'apiKey',
    schema: BlogInfoResponseSchema,
    signal,
  });
  return response.blog;
}

export interface GetBlogPostsParams {
  name: string;
  /** Unix seconds cursor. */
  before?: number;
  tag?: string;
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}

/** `GET /v2/blog/{name}/posts?npf=true&reblog_info=true` (API key). */
export function getBlogPosts({
  name,
  before,
  tag,
  limit = 20,
  offset,
  signal,
}: GetBlogPostsParams): Promise<BlogPostsResponse> {
  return apiFetch(`${blogPath(name)}/posts`, {
    query: { npf: true, reblog_info: true, limit, before, tag, offset },
    auth: 'apiKey',
    schema: BlogPostsResponseSchema,
    signal,
  });
}

export const AVATAR_SIZES = [16, 24, 30, 40, 48, 64, 96, 128, 512] as const;
export type AvatarSize = (typeof AVATAR_SIZES)[number];

/** No-auth avatar URL; it 301s to the image so it can be handed straight to `<Image>`. */
export function avatarUrl(name: string, size: AvatarSize = 128): string {
  return `${API_BASE_URL}${blogPath(name)}/avatar/${size}`;
}
