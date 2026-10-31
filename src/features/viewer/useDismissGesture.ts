import { usePanGesture } from 'react-native-gesture-handler';
import { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { dismissProgress, shouldDismiss } from './zoomMath';

export interface DismissGestureOptions {
  /** Off while zoomed: the pan then belongs to the image. */
  enabled: boolean;
  containerHeight: number;
  reducedMotion: boolean;
  onDismiss: () => void;
}

/**
 * Swipe down on an un-zoomed page: content follows the finger (translate + scale), the
 * backdrop fades; releasing past 120 dp (or flinging) dismisses (DESIGN §3.7).
 */
export function useDismissGesture({
  enabled,
  containerHeight,
  reducedMotion,
  onDismiss,
}: DismissGestureOptions) {
  const dragY = useSharedValue(0);
  const duration = reducedMotion ? 0 : 200;

  const gesture = usePanGesture({
    enabled,
    maxPointers: 1,
    // Only downward drags activate; horizontal motion fails so the pager keeps swiping.
    activeOffsetY: 16,
    failOffsetX: [-16, 16],
    onUpdate: (e) => {
      'worklet';
      dragY.set(Math.max(0, e.translationY));
    },
    onDeactivate: (e) => {
      'worklet';
      if (shouldDismiss(e.translationY, e.velocityY)) {
        dragY.set(withTiming(containerHeight, { duration }));
        scheduleOnRN(onDismiss);
      } else {
        dragY.set(withTiming(0, { duration }));
      }
    },
  });

  const contentStyle = useAnimatedStyle(() => {
    const progress = dismissProgress(dragY.get(), containerHeight);
    const scale = reducedMotion ? 1 : interpolate(progress, [0, 1], [1, 0.75]);
    return { transform: [{ translateY: dragY.get() }, { scale }] };
  });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dismissProgress(dragY.get(), containerHeight), [0, 0.6], [1, 0], 'clamp'),
  }));

  return { gesture, contentStyle, backdropStyle };
}
