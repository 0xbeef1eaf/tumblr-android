import { memo, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';

import type { GalleryItem } from '@/domain/galleryItem';
import { pickVariant } from '@/domain/media';
import {
  displayVariants,
  gridVariant,
  SAFE_BLUR_RADIUS,
  tileAccessibilityLabel,
} from '@/features/gallery';
import { useIsRevealed, useRevealStore } from '@/features/gallery/revealStore';
import { Pressable, Text } from '@/ui/primitives';
import { spacing } from '@/ui/theme';

import { VideoPage } from './VideoPage';
import { ZoomableImage } from './ZoomableImage';
import type { Size } from './zoomMath';

export interface ViewerPageProps {
  item: GalleryItem;
  active: boolean;
  /** Window size in dp; the media box is this minus the safe-area insets. */
  size: Size;
  /** Screen width in physical pixels (viewer variant target). */
  screenWidthPx: number;
  /** Grid column width in physical pixels (placeholder = the cached tile variant). */
  gridWidthPx: number;
  safeMode: boolean;
  onZoomChange: (zoomed: boolean) => void;
  onToggleChrome: () => void;
  /** Double tap on an image page (the viewer likes the post); off when undefined. */
  onDoubleTap?: (item: GalleryItem) => void;
}

/**
 * Full-resolution variant for the viewer (ARCHITECTURE §5.3: target = screen width px).
 * GIF pages only ever get an animated variant, never the tile's poster still.
 */
export function viewerVariant(item: Pick<GalleryItem, 'kind' | 'variants'>, screenWidthPx: number) {
  return pickVariant(displayVariants(item), screenWidthPx);
}

/**
 * Fit-to-screen box for the media: the window minus the safe-area insets (status bar and
 * display cutout on top, navigation bar at the bottom, cutouts left/right in landscape).
 */
export function mediaBox(size: Size, insets: EdgeInsets): Size & { top: number; left: number } {
  return {
    top: insets.top,
    left: insets.left,
    width: Math.max(0, size.width - insets.left - insets.right),
    height: Math.max(0, size.height - insets.top - insets.bottom),
  };
}

function ViewerPageImpl({
  item,
  active,
  size,
  screenWidthPx,
  gridWidthPx,
  safeMode,
  onZoomChange,
  onToggleChrome,
  onDoubleTap,
}: ViewerPageProps) {
  const revealed = useIsRevealed(item.postId);
  const reveal = useRevealStore((s) => s.reveal);
  const hidden = safeMode && item.isSensitive && !revealed;
  const { top, left, ...box } = mediaBox(size, useSafeAreaInsets());
  const boxStyle = { top, left, width: box.width, height: box.height };
  const doubleTap = useCallback(() => onDoubleTap?.(item), [onDoubleTap, item]);

  if (item.kind === 'video' && item.videoUrl && !hidden) {
    return (
      <View style={styles.fill}>
        <View style={[styles.box, boxStyle]} testID={`viewer-box-${item.id}`}>
          <VideoPage item={item} active={active} targetWidthPx={screenWidthPx} />
        </View>
      </View>
    );
  }

  const full = viewerVariant(item, screenWidthPx);
  const placeholder = gridVariant(item, gridWidthPx);
  if (!full) return <View style={styles.fill} />;

  return (
    <View style={styles.fill}>
      <View style={[styles.box, boxStyle]} testID={`viewer-box-${item.id}`}>
        <ZoomableImage
          uri={hidden && placeholder ? placeholder.url : full.url}
          // expo-image does not blur the placeholder: none while the item is hidden.
          placeholderUri={
            !hidden && placeholder && placeholder.url !== full.url ? placeholder.url : undefined
          }
          aspectRatio={item.aspectRatio}
          size={box}
          active={active}
          autoplay={item.kind === 'gif'}
          blurRadius={hidden ? SAFE_BLUR_RADIUS : undefined}
          accessibilityLabel={tileAccessibilityLabel(item)}
          onZoomChange={onZoomChange}
          onSingleTap={onToggleChrome}
          onDoubleTap={onDoubleTap ? doubleTap : undefined}
          testID={`viewer-image-${item.id}`}
        />
      </View>
      {hidden ? (
        <View style={styles.sensitive} pointerEvents="box-none">
          <Pressable
            onPress={() => reveal(item.postId)}
            accessibilityLabel="Sensitive content. Reveal"
            style={styles.reveal}
            testID="viewer-reveal"
          >
            <Text variant="label" style={styles.light}>
              Sensitive — tap to reveal
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export const ViewerPage = memo(ViewerPageImpl);

const styles = StyleSheet.create({
  fill: { flex: 1 },
  box: { position: 'absolute' },
  sensitive: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reveal: {
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  light: { color: '#ffffff' },
});
