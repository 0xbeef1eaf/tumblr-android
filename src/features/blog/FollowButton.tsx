import { StyleSheet } from 'react-native';

import { Pressable, Text } from '@/ui/primitives';
import { radius, spacing, useTheme } from '@/ui/theme';

import { useFollowAvailability, type UseFollowHook } from './useFollowAdapter';

interface FollowButtonInnerProps {
  blogName: string;
  useFollowHook: UseFollowHook;
}

function FollowButtonInner({ blogName, useFollowHook }: FollowButtonInnerProps) {
  const { colors } = useTheme();
  const { isFollowing, toggle, isPending } = useFollowHook(blogName);
  return (
    <Pressable
      onPress={() => void toggle()}
      disabled={isPending}
      accessibilityLabel={isFollowing ? `Unfollow ${blogName}` : `Follow ${blogName}`}
      testID="follow-button"
      style={[
        styles.button,
        isFollowing
          ? { backgroundColor: colors.surface, borderColor: colors.border }
          : { backgroundColor: colors.accent, borderColor: colors.accent },
      ]}
    >
      <Text variant="label" tone={isFollowing ? 'primary' : 'onAccent'}>
        {isFollowing ? 'Following' : 'Follow'}
      </Text>
    </Pressable>
  );
}

/** Follow/Unfollow, rendered only for signed-in users when WP4's `useFollow` is available. */
export function FollowButton({ blogName }: { blogName: string }) {
  const useFollowHook = useFollowAvailability();
  if (!useFollowHook) return null;
  return <FollowButtonInner blogName={blogName} useFollowHook={useFollowHook} />;
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.chip,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
