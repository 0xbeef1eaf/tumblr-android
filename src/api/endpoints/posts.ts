import { z } from 'zod';

import { apiFetch, getTokenProvider } from '../client';
import { NotFoundError } from '../errors';
import { BlogPostsResponseSchema } from '../schemas/blog';
import { PostSchema, type Post } from '../schemas/post';

/** Single-post endpoint returns the post itself; tolerate a `{ post }` wrapper too. */
const SinglePostResponseSchema = z.union([
  z.looseObject({ post: PostSchema }).transform((r) => r.post),
  PostSchema,
]);

export interface GetPostOptions {
  /** Force guest mode (skip the OAuth-only endpoint). Defaults to "use token if present". */
  guest?: boolean;
  signal?: AbortSignal;
}

/**
 * Fetch one post. Signed in: `GET /v2/blog/{blog}/posts/{id}?post_format=npf` (OAuth).
 * Guest: `GET /v2/blog/{blog}/posts?id={id}&npf=true` (API key).
 */
export async function getPost(
  blog: string,
  id: string,
  options: GetPostOptions = {},
): Promise<Post> {
  const blogSegment = encodeURIComponent(blog);
  const token = options.guest ? null : await getTokenProvider().getAccessToken();
  if (token) {
    return apiFetch(`/v2/blog/${blogSegment}/posts/${encodeURIComponent(id)}`, {
      query: { post_format: 'npf' },
      auth: 'bearer',
      schema: SinglePostResponseSchema,
      signal: options.signal,
    });
  }
  const response = await apiFetch(`/v2/blog/${blogSegment}/posts`, {
    query: { id, npf: true, reblog_info: true },
    auth: 'apiKey',
    schema: BlogPostsResponseSchema,
    signal: options.signal,
  });
  const post = response.posts.find((p) => p.id_string === id) ?? response.posts[0];
  if (!post) throw new NotFoundError({ detail: `Post ${id} not found on ${blog}` });
  return post;
}
