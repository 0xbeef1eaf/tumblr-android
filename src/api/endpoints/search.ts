import { apiFetch } from '../client';
import { SearchResponseSchema, type SearchPage } from '../schemas/search';

export interface SearchPostsParams {
  query: string;
  /** `recent` is chronological (like `/tagged`); `top` is Tumblr's relevance ranking. */
  mode?: 'recent' | 'top';
  /** `nextQuery` of the previous page; when set it is sent as-is for the next page. */
  next?: string;
  limit?: number;
  signal?: AbortSignal;
}

/**
 * `GET /v2/timeline/search` (signed in). Unlike the legacy `/v2/tagged`, which Tumblr says
 * returns intentionally partial results, this is what tumblr.com searches with, so results
 * follow the account's "Content you see" settings (mature content included when shown).
 */
export function searchPosts({
  query,
  mode = 'recent',
  next,
  limit = 20,
  signal,
}: SearchPostsParams): Promise<SearchPage> {
  const base = {
    query,
    mode,
    timeline_type: 'post',
    reblog_info: true,
    limit,
  };
  return apiFetch('/v2/timeline/search', {
    query: next ? { ...base, ...Object.fromEntries(new URLSearchParams(next)) } : base,
    auth: 'bearer',
    schema: SearchResponseSchema,
    signal,
  });
}
