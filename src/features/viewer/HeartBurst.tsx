import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Icon } from '@/ui/primitives';
import { useTheme } from '@/ui/theme';

/** Total length of the burst; with reduced motion the heart just flashes this long. */
export const HEART_BURST_MS = 600;
export const HEART_FLASH_MS = 400;
const HEART_SIZE = 96;

export interface HeartBurstProps {
  reducedMotion: boolean;
  /** Called when the burst is over (the parent unmounts it). */
  onDone: () => void;
}

/**
 * Heart that pops and fades over the image after a double-tap like (DESIGN §3.7).
 * Mount a fresh one (new `key`) per double tap; it never takes touches.
 */
export function HeartBurst({ reducedMotion, onDone }: HeartBurstProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(reducedMotion ? 1 : 0.4);
  const opacity = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (!reducedMotion) {
      scale.set(withSequence(withTiming(1.2, { duration: 180 }), withTiming(1, { duration: 120 })));
      opacity.set(
        withSequence(
          withTiming(1, { duration: 120 }),
          withDelay(240, withTiming(0, { duration: 240 })),
        ),
      );
    }
    const timer = setTimeout(onDone, reducedMotion ? HEART_FLASH_MS : HEART_BURST_MS);
    return () => clearTimeout(timer);
  }, [reducedMotion, onDone, scale, opacity]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ scale: scale.get() }],
  }));

  return (
    <View style={styles.center} pointerEvents="none" testID="heart-burst">
      <Animated.View style={[styles.shadow, style]}>
        <Icon name="heart" size={HEART_SIZE} color={colors.like} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadow: {
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
  },
});
