import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { isApiError } from '@/api/errors';
import type { TumblrNotification } from '@/api/schemas/notifications';
import { SignInPrompt, useSession } from '@/features/auth';
import { MessageView } from '@/features/tag/MessageView';
import { Chip, Pressable, Skeleton, Text } from '@/ui/primitives';
import { spacing, useTheme } from '@/ui/theme';

import { NotificationRow } from './NotificationRow';
import { blogHref, notificationHref } from './notificationText';
import { useNotifications, type NotificationFilter } from './useNotifications';

const FILTERS: { value: NotificationFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'mentions', label: 'Mentions' },
  { value: 'reblogs', label: 'Reblogs' },
  { value: 'replies', label: 'Replies' },
  { value: 'follows', label: 'Follows' },
  { value: 'likes', label: 'Likes' },
];

/** Empty-state copy when a filter chip other than All matches nothing. */
const EMPTY_COPY: Record<Exclude<NotificationFilter, 'all'>, { title: string; body: string }> = {
  mentions: {
    title: 'No mentions yet',
    body: 'When someone mentions your blog, it will show up here.',
  },
  reblogs: {
    title: 'No reblogs yet',
    body: 'When someone reblogs your posts, it will show up here.',
  },
  replies: {
    title: 'No replies yet',
    body: 'When someone replies to your posts, it will show up here.',
  },
  follows: {
    title: 'No new followers yet',
    body: 'When someone follows your blog, it will show up here.',
  },
  likes: { title: 'No likes yet', body: 'When someone likes your posts, it will show up here.' },
};

/** Tumblr answers 403 when the token or blog may not read notifications. */
export function isNotificationsForbidden(error: unknown): boolean {
  return isApiError(error) && error.status === 403;
}

function FilterChips({
  value,
  onChange,
}: {
  value: NotificationFilter;
  onChange: (value: NotificationFilter) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chips}
      style={styles.chipBar}
      testID="notification-filters"
    >
      {FILTERS.map((filter) => (
        <Chip
          key={filter.value}
          label={filter.label}
          selected={filter.value === value}
          onPress={() => onChange(filter.value)}
          testID={`notification-filter-${filter.value}`}
        />
      ))}
    </ScrollView>
  );
}

function LoadingRows() {
  return (
    <View testID="notifications-loading">
      {Array.from({ length: 8 }, (_, i) => (
        <View key={i} style={styles.skeletonRow}>
          <Skeleton width={40} height={40} radius={20} />
          <View style={styles.skeletonText}>
            <Skeleton width="80%" height={14} />
            <Skeleton width="30%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

const openBlog = (name: string) => router.push(blogHref(name));

function NotificationsList() {
  const { colors } = useTheme();
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const feed = useNotifications(filter);

  const onPress = useCallback((n: TumblrNotification) => {
    const href = notificationHref(n);
    if (href) router.push(href);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: TumblrNotification }) => (
      <NotificationRow
        notification={item}
        onPress={notificationHref(item) ? onPress : undefined}
        onPressBlog={openBlog}
        nowMs={feed.updatedAt}
      />
    ),
    [onPress, feed.updatedAt],
  );

  if (!feed.enabled) {
    return (
      <MessageView
        icon="notifications-off-outline"
        title="No blog to show"
        body="Notifications belong to a blog, and this account doesn't have one yet."
        testID="notifications-no-blog"
      />
    );
  }

  let body: React.ReactNode;
  if (isNotificationsForbidden(feed.error) && feed.notifications.length === 0) {
    body = (
      <MessageView
        icon="lock-closed-outline"
        title="Notifications aren't available"
        body="Tumblr didn't allow this app to read your blog's notifications. Try signing out and in again."
        testID="notifications-forbidden"
      />
    );
  } else if (feed.error && feed.notifications.length === 0) {
    body = (
      <MessageView
        icon="cloud-offline-outline"
        title="Couldn't load notifications"
        body="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => void feed.refetch()}
        testID="notifications-error"
      />
    );
  } else if (feed.isLoading) {
    body = <LoadingRows />;
  } else {
    body = (
      <FlatList
        data={feed.notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage && !feed.error)
            void feed.fetchNextPage();
        }}
        onEndReachedThreshold={1}
        refreshControl={
          <RefreshControl
            refreshing={feed.isRefetching}
            onRefresh={() => void feed.refresh()}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
        )}
        ListEmptyComponent={
          filter === 'all' ? (
            <MessageView
              icon="notifications-outline"
              title="No notifications yet"
              body="Likes, reblogs, replies and new followers will show up here."
              testID="notifications-empty"
            />
          ) : (
            <MessageView
              icon="notifications-outline"
              title={EMPTY_COPY[filter].title}
              body={EMPTY_COPY[filter].body}
              actionLabel="Show all"
              onAction={() => setFilter('all')}
              testID="notifications-empty-filtered"
            />
          )
        }
        ListFooterComponent={
          feed.isFetchingNextPage ? (
            <ActivityIndicator
              color={colors.accent}
              style={styles.footer}
              testID="notifications-loading-more"
            />
          ) : feed.error && feed.notifications.length > 0 ? (
            <View style={styles.loadMoreError} testID="notifications-load-more-error">
              <Text tone="secondary">{"Couldn't load more"}</Text>
              <Pressable
                onPress={() => void feed.fetchNextPage()}
                accessibilityLabel="Try loading more again"
                testID="notifications-load-more-retry"
              >
                <Text variant="bodyStrong" tone="accent">
                  Try again
                </Text>
              </Pressable>
            </View>
          ) : undefined
        }
        testID="notifications-list"
      />
    );
  }

  return (
    <View style={styles.root}>
      <FilterChips value={filter} onChange={setFilter} />
      {body}
    </View>
  );
}

/** Notifications tab: activity on the user's primary blog; guests are asked to sign in. */
export function NotificationsScreen() {
  const { colors } = useTheme();
  const { status } = useSession();
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {status === 'signedIn' ? (
        <NotificationsList />
      ) : status === 'loading' ? (
        <View style={styles.center} testID="notifications-session-loading">
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <SignInPrompt
          icon="notifications-outline"
          title="Notifications"
          body="Sign in to Tumblr to see likes, reblogs, replies and new followers."
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  chipBar: { flexGrow: 0 },
  chips: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  skeletonText: { flex: 1, gap: spacing.sm },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: spacing.xl + 40 + spacing.md },
  footer: { padding: spacing.lg },
  loadMoreError: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
});
