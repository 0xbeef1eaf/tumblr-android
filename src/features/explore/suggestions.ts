import type { BlogInfo } from '@/api/schemas/blog';

/** Followed blogs whose own following lists are read (most recently followed first). */
export const SUGGESTION_SOURCES = 15;
/** Suggestions kept after ranking. */
export const MAX_SUGGESTIONS = 30;
/** Extra `/user/following` pages (after the first) read only to exclude followed blogs. */
export const EXCLUSION_EXTRA_PAGES = 4;
/** Source lists fetched at once: no bursts (ARCHITECTURE §6 budget). */
export const SOURCE_CONCURRENCY = 3;

/** One followed blog's public following list (empty when hidden or failed). */
export interface SourceFollowing {
  name: string;
  blogs: readonly Pick<BlogInfo, 'name' | 'title' | 'updated'>[];
}

export interface SuggestedBlog {
  name: string;
  title?: string;
  updated?: number;
  /** Followed blogs that follow this one, in source order (most recently followed first). */
  via: string[];
}

/** Lower-cased blog name without `.tumblr.com`, for comparing names from different sources. */
export const blogKey = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/\.tumblr\.com$/, '');

/**
 * Who the blogs you follow follow: every blog in the source lists that is not excluded (already
 * followed, your own), ranked by how many sources follow it, then by latest post (`updated`),
 * then by first appearance. Keeps the top `limit`.
 */
export function rankSuggestions(
  sources: readonly SourceFollowing[],
  exclude: Iterable<string>,
  limit = MAX_SUGGESTIONS,
): SuggestedBlog[] {
  const excluded = new Set(Array.from(exclude, blogKey));
  const byKey = new Map<string, SuggestedBlog & { order: number }>();
  for (const source of sources) {
    const sourceKey = blogKey(source.name);
    for (const blog of source.blogs) {
      const key = blogKey(blog.name);
      if (!key || key === sourceKey || excluded.has(key)) continue;
      const entry = byKey.get(key);
      if (!entry) {
        byKey.set(key, {
          name: blog.name,
          title: blog.title,
          updated: blog.updated,
          via: [source.name],
          order: byKey.size,
        });
      } else if (!entry.via.includes(source.name)) {
        entry.via.push(source.name);
        entry.title ??= blog.title;
        if ((blog.updated ?? 0) > (entry.updated ?? 0)) entry.updated = blog.updated;
      }
    }
  }
  return [...byKey.values()]
    .sort(
      (a, b) =>
        b.via.length - a.via.length || (b.updated ?? 0) - (a.updated ?? 0) || a.order - b.order,
    )
    .slice(0, limit)
    .map(({ order: _order, ...suggestion }) => suggestion);
}

/** "Followed by alice, bob +3". */
export function formatVia(via: readonly string[], shown = 2): string {
  const names = via.slice(0, shown).join(', ');
  const rest = via.length - shown;
  return `Followed by ${names}${rest > 0 ? ` +${rest}` : ''}`;
}

/** Runs `task` over `items` with at most `limit` in flight; results keep input order. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index] as T);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
