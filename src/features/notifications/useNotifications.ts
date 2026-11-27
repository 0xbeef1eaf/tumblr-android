import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { getNotifications } from '@/api/endpoints/notifications';
import type { NotificationsPage, TumblrNotification } from '@/api/schemas/notifications';
import { useAuthStore } from '@/features/auth';
import { MINUTE } from '@/lib/queryClient';

export type NotificationFilter = 'all' | 'mentions' | 'reblogs' | 'replies' | 'follows' | 'likes';

/** `types[]` sent for each filter chip; `all` sends none. */
export const FILTER_TYPES: Record<NotificationFilter, readonly string[]> = {
  all: [],
  mentions: ['mention_in_reply', 'mention_in_post'],
  reblogs: ['reblog_naked', 'reblog_with_content'],
  replies: ['reply'],
  follows: ['follow'],
  likes: ['like'],
};

export const NOTIFICATIONS_QUERY_ROOT = 'notifications';

type Data = InfiniteData<NotificationsPage, number | undefined>;

/** Stop on an empty page, a missing cursor, or a cursor that was already requested. */
export function nextNotificationsCursor(
  last: NotificationsPage,
  pageParams: readonly (number | undefined)[],
): number | undefined {
  if (last.notifications.length === 0 || last.nextBefore === undefined) return undefined;
  return pageParams.includes(last.nextBefore) ? undefined : last.nextBefore;
}

export interface NotificationsResult {
  notifications: TumblrNotification[];
  /** Signed in with a primary blog (the endpoint needs a blog the user owns). */
  enabled: boolean;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
  /** Pull-to-refresh: trims to the first page and refetches only that page. */
  refresh: () => Promise<unknown>;
  /** Refetch every loaded page (error-state Retry). */
  refetch: () => Promise<unknown>;
  isRefetching: boolean;
  error: Error | null;
  /** When the loaded pages were fetched (ms); row ages are measured from it. */
  updatedAt: number;
}

/** The signed-in user's activity on their primary blog, paged by `before`. */
export function useNotifications(filter: NotificationFilter = 'all'): NotificationsResult {
  const signedIn = useAuthStore((s) => s.status === 'signedIn');
  const blog = useAuthStore((s) => s.user?.primaryBlog);
  const queryClient = useQueryClient();
  const enabled = signedIn && !!blog;
  const queryKey = useMemo(() => [NOTIFICATIONS_QUERY_ROOT, blog ?? '', filter], [blog, filter]);

  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam, signal }) =>
      getNotifications({
        blog: blog ?? '',
        before: pageParam,
        types: FILTER_TYPES[filter],
        signal,
      }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last, _all, _lastParam, pageParams) =>
      nextNotificationsCursor(last, pageParams),
    enabled,
    staleTime: MINUTE,
  });

  const notifications = useMemo(() => {
    const seen = new Set<string>();
    return (query.data?.pages ?? []).flatMap((page) =>
      page.notifications.filter((n) => !seen.has(n.id) && seen.add(n.id)),
    );
  }, [query.data]);

  const { refetch } = query;
  const refresh = useCallback((): Promise<unknown> => {
    queryClient.setQueryData<Data>(
      queryKey,
      (data) => data && { pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) },
    );
    return refetch();
  }, [queryClient, queryKey, refetch]);

  return {
    notifications,
    enabled,
    isLoading: enabled && query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    refresh,
    refetch,
    isRefetching: query.isRefetching && !query.isFetchingNextPage,
    error: query.error,
    updatedAt: query.dataUpdatedAt,
  };
}
