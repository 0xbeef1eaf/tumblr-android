import { apiFetch } from '../client';
import { PostListSchema, type Post } from '../schemas/post';

export interface GetTaggedParams {
  tag: string;
  /** Unix seconds; returns posts tagged before this time. */
  before?: number;
  limit?: number;
  filter?: 'text' | 'raw' | 'html';
  signal?: AbortSignal;
}

/** `GET /v2/tagged` — legacy-format posts for a tag (API key). */
export function getTagged({
  tag,
  before,
  limit = 20,
  filter = 'text',
  signal,
}: GetTaggedParams): Promise<Post[]> {
  return apiFetch('/v2/tagged', {
    query: { tag, before, limit, filter },
    auth: 'auto',
    schema: PostListSchema,
    signal,
  });
}
