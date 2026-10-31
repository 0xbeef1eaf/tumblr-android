import { Image } from 'expo-image';
import { memo, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { avatarUrl } from '@/api/endpoints/blog';
import type { GalleryItem } from '@/domain/galleryItem';
import { clampAspect } from '@/domain/media';
import { Icon, Pressable, Text } from '@/ui/primitives';
import { motion, radius, spacing, useTheme } from '@/ui/theme';
import { useReducedMotion } from '@/ui/useReducedMotion';

import { gridVariant, tileAccessibilityLabel, tileBadges } from './layout';
import { useIsRevealed, useRevealStore } from './revealStore';

export interface GalleryTileProps {
  item: GalleryItem;
  /** Position in the (filtered) list passed to `onPress`. */
  index: number;
  /** Column width in physical pixels, used to pick the variant. */
  columnWidthPx: number;
  showBlogName: boolean;
  safeMode: boolean;
  /** Decided by the parent: only a few visible GIFs animate at once. */
  animateGifs: boolean;
  onPress: (item: GalleryItem, index: number) => void;
  onLongPress?: (item: GalleryItem, index: number) => void;
}

/** SAFE_BLUR per DESIGN §4. */
export const SAFE_BLUR_RADIUS = 30;

function GalleryTileImpl({
  item,
  index,
  columnWidthPx,
  showBlogName,
  safeMode,
  animateGifs,
  onPress,
  onLongPress,
}: GalleryTileProps) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const revealed = useIsRevealed(item.postId);
  const reveal = useRevealStore((s) => s.reveal);
  const hidden = safeMode && item.isSensitive && !revealed;

  const variant = gridVariant(item, columnWidthPx);
  const badges = tileBadges(item);
  const label = tileAccessibilityLabel(item);

  const handlePress = useCallback(() => {
    if (hidden) reveal(item.postId);
    else onPress(item, index);
  }, [hidden, reveal, onPress, item, index]);
  const handleLongPress = useCallback(() => onLongPress?.(item, index), [onLongPress, item, index]);

  return (
    <Pressable
      noMinSize
      pressedOpacity={0.85}
      onPress={handlePress}
      onLongPress={onLongPress ? handleLongPress : undefined}
      delayLongPress={350}
      accessibilityLabel={hidden ? `Sensitive content. ${label}` : label}
      accessibilityHint={hidden ? 'Double tap to reveal' : 'Opens the viewer'}
      testID={`tile-${item.id}`}
      style={[
        styles.tile,
        {
          aspectRatio: clampAspect(item.aspectRatio),
          backgroundColor: item.placeholderColor ?? colors.surface,
        },
      ]}
    >
      {variant ? (
        <Image
          source={{ uri: variant.url, width: variant.width, height: variant.height }}
          recyclingKey={item.id}
          cachePolicy="memory-disk"
          contentFit="cover"
          transition={reducedMotion ? 0 : motion.normal}
          autoplay={item.kind === 'gif' ? animateGifs : false}
          blurRadius={hidden ? SAFE_BLUR_RADIUS : undefined}
          style={StyleSheet.absoluteFill}
          accessible={false}
          testID={`tile-image-${item.id}`}
        />
      ) : null}

      {badges.length > 0 ? (
        <View style={styles.badges} pointerEvents="none">
          {badges.map((badge) => (
            <View
              key={badge.key}
              style={[styles.badge, { backgroundColor: colors.overlay }]}
              accessibilityLabel={badge.accessibilityLabel}
              testID={`badge-${badge.key}`}
            >
              <Text variant="caption" style={styles.badgeText}>
                {badge.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {hidden ? (
        <View style={styles.sensitive} pointerEvents="none" testID="tile-sensitive">
          <Icon name="eye-off-outline" size={20} color="#ffffff" />
          <Text variant="label" style={styles.overlayText}>
            Sensitive
          </Text>
          <Text variant="caption" style={styles.overlayText}>
            Tap to reveal
          </Text>
        </View>
      ) : null}

      {showBlogName ? (
        <View
          style={[styles.blog, { backgroundColor: colors.overlay }]}
          pointerEvents="none"
          testID="tile-blog"
        >
          <Image
            source={{ uri: avatarUrl(item.blogName, 24) }}
            cachePolicy="memory-disk"
            style={styles.avatar}
            accessible={false}
          />
          <Text variant="caption" numberOfLines={1} style={styles.blogName}>
            {item.blogName}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Masonry tile (DESIGN §4). Memoised: re-renders only when its inputs change. */
export const GalleryTile = memo(GalleryTileImpl);

const styles = StyleSheet.create({
  tile: { width: '100%', borderRadius: radius.tile, overflow: 'hidden' },
  badges: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  badge: { borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: '#ffffff', fontWeight: '600' },
  sensitive: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  overlayText: { color: '#ffffff' },
  blog: {
    position: 'absolute',
    left: spacing.xs,
    bottom: spacing.xs,
    maxWidth: '90%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.chip,
    paddingLeft: 2,
    paddingRight: spacing.sm,
    paddingVertical: 2,
  },
  avatar: { width: 20, height: 20, borderRadius: 10 },
  blogName: { color: '#ffffff', flexShrink: 1 },
});
