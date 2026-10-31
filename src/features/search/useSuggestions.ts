import { useMemo } from 'react';

import { normalizeTag } from '@/features/tag/normalizeTag';

import {
  sameEntry,
  useSearchHistoryStore,
  type SearchEntryType,
  type SearchHistoryEntry,
} from './searchHistoryStore';

export type Suggestion =
  | { key: string; kind: 'tag'; value: string }
  | { key: string; kind: 'blog'; value: string }
  | { key: string; kind: 'recent'; entryType: SearchEntryType; value: string };

export const BLOG_NAME_PATTERN = /^[a-z0-9-]{1,32}$/i;
export const MAX_RECENT_SUGGESTIONS = 5;

/**
 * Suggestions for a query (DESIGN §3.3): the tag first, a blog when the query looks like a
 * blog name, then matching recent searches (without repeating the two above).
 */
export function buildSuggestions(
  query: string,
  recents: readonly SearchHistoryEntry[],
): Suggestion[] {
  const tag = normalizeTag(query);
  if (!tag) return [];
  const result: Suggestion[] = [{ key: `tag:${tag}`, kind: 'tag', value: tag }];
  const blog = BLOG_NAME_PATTERN.test(tag) ? tag.toLowerCase() : undefined;
  if (blog) result.push({ key: `blog:${blog}`, kind: 'blog', value: blog });

  const needle = tag.toLowerCase();
  const matching = recents
    .filter((entry) => entry.value.toLowerCase().includes(needle))
    .filter((entry) => !sameEntry(entry, 'tag', tag) && !(blog && sameEntry(entry, 'blog', blog)))
    .slice(0, MAX_RECENT_SUGGESTIONS);
  for (const entry of matching) {
    result.push({
      key: `recent:${entry.type}:${entry.value.toLowerCase()}`,
      kind: 'recent',
      entryType: entry.type,
      value: entry.value,
    });
  }
  return result;
}

export function useSuggestions(query: string): Suggestion[] {
  const entries = useSearchHistoryStore((state) => state.entries);
  return useMemo(() => buildSuggestions(query, entries), [query, entries]);
}
