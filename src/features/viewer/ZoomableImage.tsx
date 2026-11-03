import { Image } from 'expo-image';
import { memo, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import {
  GestureDetector,
  useExclusiveGestures,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useReducedMotion } from '@/ui/useReducedMotion';

import {
  clampScale,
  clampTranslation,
  fitContain,
  MIN_SCALE,
  zoomAround,
  ZOOM_EPSILON,
  type Size,
} from './zoomMath';

export interface ZoomableImageProps {
  uri: string;
  /** Already-cached grid variant shown until `uri` arrives. */
  placeholderUri?: string;
  aspectRatio: number;
  /** Media box in dp (window minus safe-area insets); fit and pan bounds use it. */
  size: Size;
  /** The page is the current one; zoom resets when it stops being current. */
  active: boolean;
  /** GIFs animate in the viewer. */
  autoplay?: boolean;
  blurRadius?: number;
  accessibilityLabel: string;
  onZoomChange?: (zoomed: boolean) => void;
  onSingleTap?: () => void;
  /** Double tap (the viewer likes the post). Without it single taps fire without delay. */
  onDoubleTap?: () => void;
  testID?: string;
}

/**
 * Pinch (1–4×, anchored at the focal point), pan while zoomed (bounds-clamped),
 * double tap → `onDoubleTap`, single tap → `onSingleTap` (DESIGN §3.7).
 */
function ZoomableImageImpl({
  uri,
  placeholderUri,
  aspectRatio,
  size,
  active,
  autoplay = true,
  blurRadius,
  accessibilityLabel,
  onZoomChange,
  onSingleTap,
  onDoubleTap,
  testID = 'zoomable-image',
}: ZoomableImageProps) {
  const reducedMotion = useReducedMotion();
  const duration = reducedMotion ? 0 : 220;
  const content = fitContain(aspectRatio, size);
  const [zoomed, setZoomed] = useState(false);

  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const start = useSharedValue({ scale: 1, x: 0, y: 0 });
  const zoomedSV = useSharedValue(false);

  const report = (next: boolean) => {
    setZoomed(next);
    onZoomChange?.(next);
  };

  // Leaving the page resets the zoom: React state during render, shared values in an effect.
  const [wasActive, setWasActive] = useState(active);
  if (wasActive !== active) {
    setWasActive(active);
    if (!active) setZoomed(false);
  }
  useEffect(() => {
    if (active) return;
    scale.set(1);
    tx.set(0);
    ty.set(0);
    zoomedSV.set(false);
  }, [active, scale, tx, ty, zoomedSV]);

  const settle = (nextScale: number, x: number, y: number) => {
    'worklet';
    const s = nextScale < MIN_SCALE + ZOOM_EPSILON ? MIN_SCALE : clampScale(nextScale);
    const t = clampTranslation(x, y, content, size, s);
    scale.set(withTiming(s, { duration }));
    tx.set(withTiming(t.x, { duration }));
    ty.set(withTiming(t.y, { duration }));
    const isZoomed = s > MIN_SCALE + ZOOM_EPSILON;
    if (isZoomed !== zoomedSV.get()) {
      zoomedSV.set(isZoomed);
      scheduleOnRN(report, isZoomed);
    }
  };

  const pinch = usePinchGesture({
    onBegin: () => {
      'worklet';
      start.set({ scale: scale.get(), x: tx.get(), y: ty.get() });
    },
    onUpdate: (e) => {
      'worklet';
      const from = start.get();
      const next = clampScale(from.scale * e.scale);
      const fx = e.focalX - size.width / 2;
      const fy = e.focalY - size.height / 2;
      const t = clampTranslation(
        zoomAround(fx, from.x, from.scale, next),
        zoomAround(fy, from.y, from.scale, next),
        content,
        size,
        next,
      );
      scale.set(next);
      tx.set(t.x);
      ty.set(t.y);
    },
    onFinalize: () => {
      'worklet';
      settle(scale.get(), tx.get(), ty.get());
    },
  });

  const pan = usePanGesture({
    enabled: zoomed,
    maxPointers: 2,
    onBegin: () => {
      'worklet';
      start.set({ scale: scale.get(), x: tx.get(), y: ty.get() });
    },
    onUpdate: (e) => {
      'worklet';
      const from = start.get();
      const t = clampTranslation(
        from.x + e.translationX,
        from.y + e.translationY,
        content,
        size,
        scale.get(),
      );
      tx.set(t.x);
      ty.set(t.y);
    },
  });

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    enabled: onDoubleTap !== undefined,
    onActivate: () => {
      'worklet';
      if (onDoubleTap) scheduleOnRN(onDoubleTap);
    },
  });

  const singleTap = useTapGesture({
    onActivate: () => {
      'worklet';
      if (onSingleTap) scheduleOnRN(onSingleTap);
    },
  });

  const taps = useExclusiveGestures(doubleTap, singleTap);
  const gesture = useSimultaneousGestures(pinch, pan, taps);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: scale.get() }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.fill, animatedStyle]} testID={testID}>
        <Image
          source={{ uri }}
          placeholder={placeholderUri ? { uri: placeholderUri } : undefined}
          placeholderContentFit="contain"
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={reducedMotion ? 0 : 150}
          autoplay={autoplay && active}
          blurRadius={blurRadius}
          priority={active ? 'high' : 'normal'}
          accessibilityLabel={accessibilityLabel}
          style={styles.fill}
          testID={`${testID}-img`}
        />
      </Animated.View>
    </GestureDetector>
  );
}

export const ZoomableImage = memo(ZoomableImageImpl);

const styles = StyleSheet.create({ fill: { flex: 1 } });
