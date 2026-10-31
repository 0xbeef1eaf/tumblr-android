import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { getFollowing } from '@/api/endpoints/user';
import type { BlogInfo } from '@/api/schemas/blog';
import { MINUTE } from '@/lib/queryClient';

import { useAuthStore } from './authStore';

export const FOLLOWING_QUERY_KEY = ['following'] as const;
const PAGE_SIZE = 20;

export interface FollowingResult {
  blogs: BlogInfo[];
  total: number;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
  hasNextPage: boolean;
}

/** Blogs the signed-in user follows, `offset` paged (empty for guests). */
export function useFollowing(): FollowingResult {
  const signedIn = useAuthStore((s) => s.status === 'signedIn');
  const query = useInfiniteQuery({
    queryKey: FOLLOWING_QUERY_KEY,
    queryFn: ({ pageParam, signal }) =>
      getFollowing({ offset: pageParam, limit: PAGE_SIZE, signal }),
    initialPageParam: 0,
    getNextPageParam: (last, all) => {
      const seen = all.reduce((n, page) => n + page.blogs.length, 0);
      return last.blogs.length === 0 || seen >= last.total_blogs ? undefined : seen;
    },
    enabled: signedIn,
    staleTime: 5 * MINUTE,
  });

  const blogs = useMemo(() => {
    const seen = new Set<string>();
    return (query.data?.pages ?? []).flatMap((page) =>
      page.blogs.filter((blog) => !seen.has(blog.name) && seen.add(blog.name)),
    );
  }, [query.data]);

  return {
    blogs,
    total: query.data?.pages[0]?.total_blogs ?? 0,
    isLoading: signedIn && query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
  };
}
