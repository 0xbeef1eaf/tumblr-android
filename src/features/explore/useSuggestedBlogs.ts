import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { getBlogFollowing } from '@/api/endpoints/blog';
import { getFollowing } from '@/api/endpoints/user';
import { ApiError } from '@/api/errors';
import type { UserInfo } from '@/api/schemas/user';
import { useSession } from '@/features/auth';
import { HOUR } from '@/lib/queryClient';

import {
  blogKey,
  EXCLUSION_EXTRA_PAGES,
  mapWithConcurrency,
  rankSuggestions,
  SOURCE_CONCURRENCY,
  SUGGESTION_SOURCES,
  type SourceFollowing,
  type SuggestedBlog,
} from './suggestions';
import type { UseFollowingHook } from './useFollowingAdapter';

/** A blog's public following list changes slowly; the `blog` root is also persisted (24 h). */
export const SOURCE_STALE_MS = 6 * HOUR;
export const SUGGESTIONS_STALE_MS = HOUR;
const FOLLOWING_PAGE_SIZE = 20;
const NO_KEEP: ReadonlySet<string> = new Set();

export const blogFollowingQueryKey = (name: string) =>
  ['blog', blogKey(name), 'following'] as const;
export const suggestedBlogsQueryKey = (user: string, sources: readonly string[]) =>
  ['suggestedBlogs', user, 'sources', sources] as const;
const exclusionQueryKey = (user: string) => ['suggestedBlogs', user, 'exclude'] as const;

/** Hidden lists (403) and unknown blogs are cached as empty; 401/429/5xx are not cached. */
const isHiddenList = (error: unknown): boolean =>
  error instanceof ApiError &&
  error.status >= 400 &&
  error.status < 500 &&
  error.status !== 401 &&
  error.status !== 429;

/** One source's first page, through the shared cache. Never throws: failures add nothing. */
async function fetchSourceFollowing(client: QueryClient, name: string): Promise<SourceFollowing> {
  try {
    const blogs = await client.fetchQuery({
      queryKey: blogFollowingQueryKey(name),
      queryFn: async ({ signal }) => {
        try {
          return (await getBlogFollowing({ name, limit: FOLLOWING_PAGE_SIZE, signal })).blogs;
        } catch (error) {
          if (isHiddenList(error)) return [];
          throw error;
        }
      },
      staleTime: SOURCE_STALE_MS,
    });
    return { name, blogs };
  } catch {
    return { name, blogs: [] };
  }
}

/** `/user/following` pages 2…(1 + EXCLUSION_EXTRA_PAGES), sequential, partial on failure. */
async function fetchMoreFollowedNames(total: number, signal: AbortSignal): Promise<string[]> {
  const names: string[] = [];
  let offset = FOLLOWING_PAGE_SIZE;
  for (let page = 0; page < EXCLUSION_EXTRA_PAGES && offset < total; page++) {
    try {
      const response = await getFollowing({ offset, limit: FOLLOWING_PAGE_SIZE, signal });
      if (response.blogs.length === 0) break;
      names.push(...response.blogs.map((b) => b.name));
      offset += response.blogs.length;
    } catch {
      break;
    }
  }
  return names;
}

export interface SuggestedBlogsResult {
  suggestions: SuggestedBlog[];
  isLoading: boolean;
  /**
   * Every followed blog was read for exclusion. When false (more than ~100 follows), rows look
   * up `/blog/{name}/info` for its `followed` flag so a followed blog is not offered.
   */
  exclusionComplete: boolean;
}

/**
 * "Followed by blogs you follow" (DESIGN §3.1): the first-page following lists of the
 * `SUGGESTION_SOURCES` most recently followed blogs, at most `SOURCE_CONCURRENCY` at a time,
 * ranked by `rankSuggestions` once the exclusion list has loaded. Excludes the user's blogs
 * and up to 100 followed blogs (past that, shown rows check blog info: `exclusionComplete`),
 * except names in `keep` (followed from this list, so the row stays and can be undone).
 *
 * Sources are frozen for the life of the screen, so a follow (which refetches `['following']`)
 * does not reshuffle the list or refetch the sources.
 */
export function useSuggestedBlogs(
  useFollowingHook: UseFollowingHook,
  keep: ReadonlySet<string> = NO_KEEP,
): SuggestedBlogsResult {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const userKey = user?.name ?? '';
  const following = useFollowingHook();
  const followed = following.blogs;

  const fresh = useMemo(
    () => (followed ?? []).slice(0, SUGGESTION_SOURCES).map((b) => b.name),
    [followed],
  );
  const [frozen, setFrozen] = useState<{ user: string; names: string[] } | null>(null);
  if (fresh.length > 0 && frozen?.user !== userKey) setFrozen({ user: userKey, names: fresh });
  const sources = frozen?.user === userKey ? frozen.names : fresh;

  const sourceLists = useQuery({
    queryKey: suggestedBlogsQueryKey(userKey, sources),
    queryFn: () =>
      mapWithConcurrency(sources, SOURCE_CONCURRENCY, (name) =>
        fetchSourceFollowing(queryClient, name),
      ),
    enabled: sources.length > 0,
    staleTime: SUGGESTIONS_STALE_MS,
    placeholderData: keepPreviousData,
  });

  const total = following.total ?? 0;
  const firstPageCount = followed?.length ?? 0;
  const needsMore = firstPageCount > 0 && total > firstPageCount;
  const moreFollowed = useQuery({
    queryKey: exclusionQueryKey(userKey),
    queryFn: ({ signal }) => fetchMoreFollowedNames(total, signal),
    enabled: needsMore,
    staleTime: SUGGESTIONS_STALE_MS,
  });
  // Rank only once the whole exclusion list is in, so rows never appear and then vanish.
  // `data === undefined` rather than `isPending`: a disabled query also reports pending.
  // fetchMoreFollowedNames returns partial names instead of throwing; isError covers aborts.
  const moreSettled = !needsMore || moreFollowed.data !== undefined || moreFollowed.isError;
  // Latched per user: a follow that pushes `total` past the first page must not blank the list.
  const [settledFor, setSettledFor] = useState<string | null>(null);
  const settledNow = !following.isLoading && moreSettled;
  if (settledNow && firstPageCount > 0 && settledFor !== userKey) setSettledFor(userKey);
  const exclusionSettled = settledNow || settledFor === userKey;

  const suggestions = useMemo(() => {
    if (!sourceLists.data || !exclusionSettled) return [];
    const ownBlogs = queryClient.getQueryData<UserInfo>(['user'])?.blogs.map((b) => b.name) ?? [];
    const keepKeys = new Set(Array.from(keep, blogKey));
    const exclude = [...(followed ?? []).map((b) => b.name), ...(moreFollowed.data ?? [])].filter(
      (name) => !keepKeys.has(blogKey(name)),
    );
    if (user?.name) exclude.push(user.name);
    if (user?.primaryBlog) exclude.push(user.primaryBlog);
    return rankSuggestions(sourceLists.data, [...exclude, ...ownBlogs]);
  }, [sourceLists.data, exclusionSettled, moreFollowed.data, followed, keep, user, queryClient]);

  return {
    suggestions,
    isLoading: following.isLoading || sourceLists.isLoading || !exclusionSettled,
    exclusionComplete: total <= firstPageCount + (moreFollowed.data?.length ?? 0),
  };
}
