import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { GalleryItem } from '@/domain/galleryItem';
import { pickVariant } from '@/domain/media';
import { gridVariant, SAFE_BLUR_RADIUS, tileAccessibilityLabel } from '@/features/gallery';
import { useIsRevealed, useRevealStore } from '@/features/gallery/revealStore';
import { Pressable, Text } from '@/ui/primitives';
import { spacing } from '@/ui/theme';

import { VideoPage } from './VideoPage';
import { ZoomableImage } from './ZoomableImage';
import type { Size } from './zoomMath';

export interface ViewerPageProps {
  item: GalleryItem;
  active: boolean;
  size: Size;
  /** Screen width in physical pixels (viewer variant target). */
  screenWidthPx: number;
  /** Grid column width in physical pixels (placeholder = the cached tile variant). */
  gridWidthPx: number;
  safeMode: boolean;
  onZoomChange: (zoomed: boolean) => void;
  onToggleChrome: () => void;
}

/** Full-resolution variant for the viewer (ARCHITECTURE §5.3: target = screen width px). */
export function viewerVariant(item: Pick<GalleryItem, 'variants'>, screenWidthPx: number) {
  return pickVariant(item.variants, screenWidthPx);
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
}: ViewerPageProps) {
  const revealed = useIsRevealed(item.postId);
  const reveal = useRevealStore((s) => s.reveal);
  const hidden = safeMode && item.isSensitive && !revealed;

  if (item.kind === 'video' && item.videoUrl && !hidden) {
    return <VideoPage item={item} active={active} targetWidthPx={screenWidthPx} />;
  }

  const full = viewerVariant(item, screenWidthPx);
  const placeholder = gridVariant(item, gridWidthPx);
  if (!full) return <View style={styles.fill} />;

  return (
    <View style={styles.fill}>
      <ZoomableImage
        uri={hidden && placeholder ? placeholder.url : full.url}
        // expo-image does not blur the placeholder: none while the item is hidden.
        placeholderUri={
          !hidden && placeholder && placeholder.url !== full.url ? placeholder.url : undefined
        }
        aspectRatio={item.aspectRatio}
        size={size}
        active={active}
        autoplay={item.kind === 'gif'}
        blurRadius={hidden ? SAFE_BLUR_RADIUS : undefined}
        accessibilityLabel={tileAccessibilityLabel(item)}
        onZoomChange={onZoomChange}
        onSingleTap={onToggleChrome}
        testID={`viewer-image-${item.id}`}
      />
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
