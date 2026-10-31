import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { GalleryItem } from '@/domain/galleryItem';
import { pickVariant } from '@/domain/media';
import { useSetting } from '@/features/settings/settingsStore';
import { Icon, Pressable } from '@/ui/primitives';

export interface VideoPageProps {
  item: GalleryItem;
  /** Current page: plays only while active, pauses when swiped away. */
  active: boolean;
  /** Poster target width in physical pixels. */
  targetWidthPx: number;
}

/** Native tumblr video via expo-video: native controls, muted by default (DESIGN §3.7). */
export function VideoPage({ item, active, targetWidthPx }: VideoPageProps) {
  const autoplayVideo = useSetting('autoplayVideo');
  const [startedByUser, setStartedByUser] = useState(false);
  const started = startedByUser || autoplayVideo;
  const poster = pickVariant(item.variants, targetWidthPx);

  const player = useVideoPlayer(item.videoUrl ?? null, (p) => {
    p.muted = true;
    p.loop = true;
  });

  // Autoplay (setting) when the page becomes current; always pause when it is not.
  useEffect(() => {
    if (!active) {
      player.pause();
      return;
    }
    if (autoplayVideo) player.play();
  }, [active, autoplayVideo, player]);

  const start = () => {
    setStartedByUser(true);
    player.play();
  };

  return (
    <View style={styles.fill} testID="video-page">
      <VideoView
        player={player}
        nativeControls={started}
        contentFit="contain"
        style={styles.fill}
        testID="video-view"
      />
      {!started ? (
        <View style={StyleSheet.absoluteFill}>
          {poster ? (
            <Image
              source={{ uri: poster.url }}
              contentFit="contain"
              cachePolicy="memory-disk"
              style={styles.fill}
              accessibilityLabel={item.altText ?? `Video from ${item.blogName}`}
              testID="video-poster"
            />
          ) : null}
          <View style={styles.center} pointerEvents="box-none">
            <Pressable
              onPress={start}
              accessibilityLabel="Play video"
              style={styles.play}
              testID="video-play"
            >
              <Icon name="play" size={36} color="#ffffff" />
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  play: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
});
