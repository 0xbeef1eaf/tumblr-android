import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { avatarUrl } from '@/api/endpoints/blog';
import { Pressable, Skeleton, Text } from '@/ui/primitives';
import { spacing, useTheme } from '@/ui/theme';

import { useFollowingAvailability, type UseFollowingHook } from './useFollowingAdapter';

const AVATAR = 56;

function FollowingRowInner({ useFollowingHook }: { useFollowingHook: UseFollowingHook }) {
  const { colors } = useTheme();
  const router = useRouter();
  const { blogs, isLoading } = useFollowingHook();
  if (!isLoading && (!blogs || blogs.length === 0)) return null;
  return (
    <View style={styles.section} testID="following-row">
      <Text variant="heading" style={styles.title}>
        Following
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {isLoading && !blogs?.length
          ? Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} width={AVATAR} height={AVATAR} radius={AVATAR / 2} />
            ))
          : blogs?.map((blog) => (
              <Pressable
                key={blog.name}
                onPress={() => router.push(`/blog/${encodeURIComponent(blog.name)}`)}
                accessibilityLabel={blog.name}
                style={styles.item}
              >
                <Image
                  source={{ uri: avatarUrl(blog.name, 64) }}
                  style={[styles.avatar, { backgroundColor: colors.surface }]}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
                <Text variant="caption" tone="secondary" numberOfLines={1} style={styles.name}>
                  {blog.name}
                </Text>
              </Pressable>
            ))}
      </ScrollView>
    </View>
  );
}

/** "Following" avatar row — signed-in only, hidden when WP4's `useFollowing` is unavailable. */
export function FollowingRow() {
  const useFollowingHook = useFollowingAvailability();
  if (!useFollowingHook) return null;
  return <FollowingRowInner useFollowingHook={useFollowingHook} />;
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  title: { paddingHorizontal: spacing.md },
  row: { gap: spacing.md, paddingHorizontal: spacing.md },
  item: { alignItems: 'center', width: AVATAR + spacing.md, gap: spacing.xs },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2 },
  name: { maxWidth: AVATAR + spacing.md },
});
