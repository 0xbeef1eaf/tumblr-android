import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { avatarUrl } from '@/api/endpoints/blog';
import type { GalleryItem } from '@/domain/galleryItem';
import { Icon, Pressable, Text } from '@/ui/primitives';
import { spacing } from '@/ui/theme';

export interface ViewerChromeProps {
  item: GalleryItem;
  index: number;
  count: number;
  visible: boolean;
  reducedMotion: boolean;
  onClose: () => void;
  onOpenBlog: (item: GalleryItem) => void;
  onOpenPost: (item: GalleryItem) => void;
  onShare: (item: GalleryItem) => void;
  onSave: (item: GalleryItem) => void;
  /** Optional Like button (WP4), rendered between Share and Save. */
  likeSlot?: ReactNode;
}

const WHITE = '#ffffff';

/** Top bar (close, "i / n") and bottom bar (blog, caption, actions) over the viewer. */
export function ViewerChrome({
  item,
  index,
  count,
  visible,
  reducedMotion,
  onClose,
  onOpenBlog,
  onOpenPost,
  onShare,
  onSave,
  likeSlot,
}: ViewerChromeProps) {
  const insets = useSafeAreaInsets();
  const fade = useAnimatedStyle(() => ({
    opacity: withTiming(visible ? 1 : 0, { duration: reducedMotion ? 0 : 180 }),
  }));
  const pointerEvents = visible ? 'box-none' : 'none';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={pointerEvents} testID="viewer-chrome">
      <Animated.View style={[styles.top, { paddingTop: insets.top + spacing.xs }, fade]}>
        <Pressable onPress={onClose} accessibilityLabel="Close viewer" testID="viewer-close">
          <View style={styles.iconButton}>
            <Icon name="close" size={28} color={WHITE} />
          </View>
        </Pressable>
        <Text variant="label" style={styles.light} accessibilityLabel={`${index + 1} of ${count}`}>
          {`${index + 1} / ${count}`}
        </Text>
        <View style={styles.iconButton} />
      </Animated.View>

      <Animated.View
        style={[styles.bottom, { paddingBottom: insets.bottom + spacing.sm }, fade]}
        testID="viewer-bottom"
      >
        <Pressable
          onPress={() => onOpenBlog(item)}
          accessibilityLabel={`Open blog ${item.blogName}`}
          style={styles.blogRow}
          testID="viewer-blog"
        >
          <Image source={{ uri: avatarUrl(item.blogName, 64) }} style={styles.avatar} />
          <Text variant="bodyStrong" style={styles.light} numberOfLines={1}>
            {item.blogName}
          </Text>
        </Pressable>
        {item.summary ? (
          <Pressable
            onPress={() => onOpenPost(item)}
            accessibilityLabel="Open post"
            noMinSize
            testID="viewer-caption"
          >
            <Text variant="body" style={styles.caption} numberOfLines={2}>
              {item.summary}
            </Text>
          </Pressable>
        ) : null}
        <View style={styles.actions}>
          <Pressable
            onPress={() => onOpenPost(item)}
            accessibilityLabel="Open post"
            testID="viewer-open-post"
            style={styles.iconButton}
          >
            <Icon name="document-text-outline" size={24} color={WHITE} />
          </Pressable>
          <Pressable
            onPress={() => onShare(item)}
            accessibilityLabel="Share"
            testID="viewer-share"
            style={styles.iconButton}
          >
            <Icon name="share-outline" size={24} color={WHITE} />
          </Pressable>
          {likeSlot}
          <Pressable
            onPress={() => onSave(item)}
            accessibilityLabel="Save"
            testID="viewer-save"
            style={styles.iconButton}
          >
            <Icon name="download-outline" size={24} color={WHITE} />
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.xs,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  light: { color: WHITE },
  caption: { color: 'rgba(255, 255, 255, 0.85)' },
  blogRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'flex-start' },
  avatar: { width: 28, height: 28, borderRadius: 14 },
  actions: { flexDirection: 'row', justifyContent: 'space-around' },
});
