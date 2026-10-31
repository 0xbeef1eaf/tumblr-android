import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { PixelRatio, StyleSheet, View } from 'react-native';

import { pickVariant, type MediaVariant } from '@/domain/media';
import { Icon, Pressable } from '@/ui/primitives';
import { radius, spacing, useTheme } from '@/ui/theme';

import { InlineVideo } from './InlineVideo';

export interface ImageViewProps {
  variants: readonly MediaVariant[];
  aspectRatio: number;
  width: number;
  placeholderColor?: string;
  altText?: string;
  onPress?: () => void;
  testID?: string;
}

/** One image at a fixed layout width; picks the narrowest variant that is sharp enough. */
export function ImageView({
  variants,
  aspectRatio,
  width,
  placeholderColor,
  altText,
  onPress,
  testID = 'npf-image',
}: ImageViewProps) {
  const { colors } = useTheme();
  const variant = pickVariant(variants, width * PixelRatio.get());
  if (!variant) return null;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      noMinSize
      accessibilityRole="image"
      accessibilityLabel={altText || 'Image'}
      style={{ width }}
    >
      <Image
        testID={testID}
        source={{ uri: variant.url }}
        style={{ width, aspectRatio, backgroundColor: placeholderColor ?? colors.surface }}
        contentFit="cover"
        transition={200}
        cachePolicy="memory-disk"
        accessibilityLabel={altText}
      />
    </Pressable>
  );
}

export interface VideoViewProps {
  poster: readonly MediaVariant[];
  aspectRatio: number;
  width: number;
  /** Native Tumblr video file; plays inline after a tap. */
  videoUrl?: string;
  /** Embeds (YouTube…) and fallbacks open here. */
  externalUrl?: string;
  testID?: string;
}

/** Poster + play button. Native video plays in place; anything else opens externally. */
export function VideoPoster({
  poster,
  aspectRatio,
  width,
  videoUrl,
  externalUrl,
  testID = 'npf-video',
}: VideoViewProps) {
  const { colors } = useTheme();
  const [playing, setPlaying] = useState(false);
  const variant = pickVariant(poster, width * PixelRatio.get());

  if (playing && videoUrl) {
    return <InlineVideo url={videoUrl} width={width} aspectRatio={aspectRatio} />;
  }

  const onPress = () => {
    if (videoUrl) setPlaying(true);
    else if (externalUrl) void Linking.openURL(externalUrl);
  };

  return (
    <Pressable
      onPress={onPress}
      noMinSize
      accessibilityLabel="Play video"
      testID={testID}
      style={{ width, aspectRatio, backgroundColor: colors.surface }}
    >
      {variant ? (
        <Image source={{ uri: variant.url }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : null}
      <View style={styles.playWrap} pointerEvents="none">
        <View style={[styles.play, { backgroundColor: colors.overlay }]}>
          <Icon name="play" size={28} color="#ffffff" />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  playWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  play: {
    width: 56,
    height: 56,
    borderRadius: radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: spacing.xs,
  },
});
