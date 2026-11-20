import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { MasonryGallery } from '@/features/gallery';
import { useSetting } from '@/features/settings/settingsStore';
import { Text } from '@/ui/primitives';
import { spacing, useTheme } from '@/ui/theme';

import { SignInPrompt } from './SignInPrompt';
import { useDashboard } from './useDashboard';
import { useIsLiked, useToggleLike } from './useLike';
import { useSession } from './useSession';

function DashboardGallery() {
  const feed = useDashboard();
  const onLike = useToggleLike();
  const isLiked = useIsLiked();
  const viewerBuffer = useSetting('dashboardBuffer');
  return (
    <MasonryGallery
      items={feed.items}
      isLoading={feed.isLoading}
      isFetchingNextPage={feed.isFetchingNextPage}
      hasNextPage={feed.hasNextPage}
      onEndReached={() => void feed.fetchNextPage()}
      onRefresh={() => void feed.refresh()}
      isRefetching={feed.isRefetching}
      onLike={onLike}
      isLiked={isLiked}
      viewerBuffer={viewerBuffer}
      emptyState={
        <View style={styles.empty} testID="dashboard-empty">
          <Text variant="heading" align="center">
            Your dashboard is empty
          </Text>
          <Text variant="body" tone="secondary" align="center">
            Follow blogs that post photos, GIFs or video and they will show up here.
          </Text>
        </View>
      }
    />
  );
}

/** Dashboard tab: media from followed blogs; guests are asked to sign in. */
export function DashboardScreen() {
  const { colors } = useTheme();
  const { status } = useSession();
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {status === 'signedIn' ? (
        <DashboardGallery />
      ) : status === 'loading' ? (
        <View style={styles.empty} testID="dashboard-loading">
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <SignInPrompt
          icon="images-outline"
          title="Your dashboard"
          body="Sign in to Tumblr to see photos, GIFs and video from the blogs you follow."
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
});
