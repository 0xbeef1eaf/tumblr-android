import { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { radius as radii, useTheme } from '../theme';
import { useReducedMotion } from '../useReducedMotion';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  /** width / height; used instead of `height` when given. */
  aspectRatio?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Placeholder block with a gentle opacity shimmer; static when reduce-motion is on. */
export function Skeleton({
  width = '100%',
  height,
  aspectRatio,
  radius = radii.tile,
  style,
  testID = 'skeleton',
}: SkeletonProps) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  // Stable Animated.Value without reading a ref during render.
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reducedMotion) {
      pulse.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reducedMotion]);

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] });

  return (
    <Animated.View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          borderRadius: radius,
          backgroundColor: colors.skeleton,
          opacity: reducedMotion ? 1 : opacity,
        },
        aspectRatio ? { aspectRatio } : { height: height ?? 16 },
        style,
      ]}
    />
  );
}
