import { z } from 'zod';

import { LinksSchema, type Links } from './envelope';
import { PostListSchema, type Post } from './post';
import { isPostElement } from './user';
import { opt } from './util';

/**
 * Query of the next page: `_links.next.query_params` when present, else the query string of
 * `href`. Serialised as a URL query string so it can be a gallery cursor. `api_key` is dropped
 * (the client adds its own auth).
 */
export function timelineNextQuery(links: Links | undefined): string | undefined {
  const next = links?.next;
  if (!next) return undefined;
  const params = new URLSearchParams();
  if (next.query_params && Object.keys(next.query_params).length > 0) {
    for (const [key, value] of Object.entries(next.query_params)) params.set(key, String(value));
  } else {
    const index = next.href.indexOf('?');
    if (index < 0) return undefined;
    new URLSearchParams(next.href.slice(index + 1)).forEach((value, key) => params.set(key, value));
  }
  params.delete('api_key');
  const query = params.toString();
  return query === '' ? undefined : query;
}

export interface SearchPage {
  posts: Post[];
  /** Timeline elements before filtering (posts plus blog cards and other objects). */
  elementCount: number;
  /** Query string of the next page (see `timelineNextQuery`). */
  nextQuery?: string;
}

/**
 * `GET /v2/timeline/search` — the endpoint tumblr.com's own search and tag pages use. Not in
 * the public docs; tolerant like the For You schema: non-post elements are dropped, a missing
 * timeline is an empty page.
 */
export const SearchResponseSchema = z
  .looseObject({
    timeline: z
      .looseObject({
        elements: z.array(z.unknown()).catch([]),
        _links: opt(LinksSchema),
      })
      .catch({ elements: [] }),
  })
  .transform(({ timeline }): SearchPage => ({
    posts: PostListSchema.parse(timeline.elements.filter(isPostElement)),
    elementCount: timeline.elements.length,
    nextQuery: timelineNextQuery(timeline._links),
  }));
