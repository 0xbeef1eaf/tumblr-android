import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { avatarUrl } from '@/api/endpoints/blog';
import type { BlogInfo } from '@/api/schemas/blog';
import { htmlToPlain } from '@/domain/text';
import { Pressable, Skeleton, Text } from '@/ui/primitives';
import { spacing, useTheme } from '@/ui/theme';

import { FollowButton } from './FollowButton';

const AVATAR_SIZE = 64;
const EXPAND_THRESHOLD = 90;

export interface BlogHeaderProps {
  name: string;
  info?: BlogInfo;
  isLoading?: boolean;
}

export function formatCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (count >= 10_000) return `${Math.round(count / 1000)}K`;
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(count);
}

/** Avatar, title, description (2 lines, expandable), post count and the Follow slot. */
export function BlogHeader({ name, info, isLoading = false }: BlogHeaderProps) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const description = htmlToPlain(info?.description);
  const canExpand = description.length > EXPAND_THRESHOLD || description.includes('\n');
  const postCount = info?.total_posts ?? info?.posts;

  return (
    <View style={styles.root} testID="blog-header">
      <View style={styles.top}>
        <Image
          source={{ uri: avatarUrl(name, 128) }}
          style={[styles.avatar, { backgroundColor: colors.surface }]}
          accessibilityLabel={`${name} avatar`}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
        <View style={styles.titles}>
          {isLoading && !info ? (
            <Skeleton width="60%" height={20} />
          ) : (
            <Text variant="heading" numberOfLines={1}>
              {info?.title || name}
            </Text>
          )}
          <Text tone="secondary" numberOfLines={1}>
            {name}
          </Text>
          {postCount !== undefined ? (
            <Text variant="caption" tone="secondary">
              {`${formatCount(postCount)} ${postCount === 1 ? 'post' : 'posts'}`}
            </Text>
          ) : null}
        </View>
        {info?.can_be_followed === false ? null : <FollowButton blogName={name} />}
      </View>
      {description ? (
        <View>
          <Text tone="secondary" numberOfLines={expanded ? undefined : 2} testID="blog-description">
            {description}
          </Text>
          {canExpand ? (
            <Pressable
              onPress={() => setExpanded((value) => !value)}
              accessibilityLabel={expanded ? 'Show less' : 'Show more'}
              noMinSize
              hitSlop={8}
            >
              <Text variant="label" tone="accent">
                {expanded ? 'Show less' : 'Show more'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md, padding: spacing.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 },
  titles: { flex: 1, gap: 2 },
});
