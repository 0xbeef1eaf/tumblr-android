import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { isApiError } from '@/api/errors';
import { MasonryGallery } from '@/features/gallery';
import { useSetting } from '@/features/settings/settingsStore';
import { MessageView } from '@/features/tag/MessageView';
import { Text } from '@/ui/primitives';
import { spacing, useTheme } from '@/ui/theme';

import { SignInPrompt } from './SignInPrompt';
import { useForYou } from './useForYou';
import { useIsLiked, useToggleLike } from './useLike';
import { useSession } from './useSession';

/** The endpoint is undocumented: Tumblr may refuse it to third-party apps (403/404). */
export function isForYouUnavailable(error: unknown): boolean {
  return isApiError(error) && (error.status === 403 || error.status === 404);
}

function ForYouGallery() {
  const feed = useForYou();
  const onLike = useToggleLike();
  const isLiked = useIsLiked();
  const viewerBuffer = useSetting('forYouBuffer');

  if (isForYouUnavailable(feed.error)) {
    return (
      <MessageView
        icon="sparkles-outline"
        title="For You isn't available"
        body="Tumblr doesn't offer this feed to third-party apps right now"
        actionLabel="Go to Dashboard"
        onAction={() => router.navigate('/dashboard')}
        testID="for-you-unavailable"
      />
    );
  }
  if (feed.error && feed.items.length === 0) {
    return (
      <MessageView
        icon="cloud-offline-outline"
        title="Couldn't load For You"
        body="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => void feed.refetch()}
        testID="for-you-error"
      />
    );
  }

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
        <View style={styles.center} testID="for-you-empty">
          <Text variant="heading" align="center">
            Nothing for you yet
          </Text>
          <Text variant="body" tone="secondary" align="center">
            Like and follow a few blogs and Tumblr will start recommending posts here.
          </Text>
        </View>
      }
      testID="for-you-gallery"
    />
  );
}

/** For You tab: Tumblr's recommendations; guests are asked to sign in (DESIGN §3.2b). */
export function ForYouScreen() {
  const { colors } = useTheme();
  const { status } = useSession();
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {status === 'signedIn' ? (
        <ForYouGallery />
      ) : status === 'loading' ? (
        <View style={styles.center} testID="for-you-loading">
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <SignInPrompt
          icon="sparkles-outline"
          title="For You"
          body="Sign in to Tumblr to see photos, GIFs and video picked for you."
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
});
