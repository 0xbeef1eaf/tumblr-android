import { StyleSheet, View } from 'react-native';

import { MasonryGallery } from '@/features/gallery';
import { Icon, Text } from '@/ui/primitives';
import { radius, spacing, useTheme } from '@/ui/theme';

import { SignInButton } from './SignInButton';
import { useToggleLike } from './useLike';
import { useLikes } from './useLikes';
import { useSession } from './useSession';

function GuestHint() {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.hint, { backgroundColor: colors.surface, borderColor: colors.border }]}
      testID="likes-guest-hint"
    >
      <Icon name="bookmark-outline" size={20} tone="textSecondary" />
      <Text variant="caption" tone="secondary" style={styles.hintText}>
        Saved on this device only. Sign in to like posts on Tumblr and keep them in sync.
      </Text>
      <SignInButton label="Sign in" />
    </View>
  );
}

/** Likes tab: Tumblr likes when signed in, local bookmarks (with a hint) as a guest. */
export function LikesScreen() {
  const { colors } = useTheme();
  const { status } = useSession();
  const feed = useLikes();
  const onLike = useToggleLike();
  const guest = status !== 'signedIn';

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <MasonryGallery
        items={feed.items}
        isLoading={feed.isLoading}
        isFetchingNextPage={feed.isFetchingNextPage}
        hasNextPage={feed.hasNextPage}
        onEndReached={() => void feed.fetchNextPage()}
        onRefresh={() => void feed.refetch()}
        isRefetching={feed.isRefetching}
        onLike={onLike}
        header={guest ? <GuestHint /> : undefined}
        emptyState={
          <View style={styles.empty} testID="likes-empty">
            <Text variant="heading" align="center">
              {guest ? 'Nothing saved yet' : 'No likes yet'}
            </Text>
            <Text variant="body" tone="secondary" align="center">
              {guest
                ? 'Tap the heart on any post to keep it here.'
                : 'Posts you like on Tumblr appear here.'}
            </Text>
          </View>
        }
      />
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
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    margin: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.tile,
    borderWidth: StyleSheet.hairlineWidth,
  },
  hintText: { flex: 1 },
});
