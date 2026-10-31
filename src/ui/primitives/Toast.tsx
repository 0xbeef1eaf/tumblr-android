import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing, useTheme } from '../theme';
import { useReducedMotion } from '../useReducedMotion';

import { Pressable } from './Pressable';
import { Text } from './Text';
import { useToastStore, type ToastMessage } from './toastStore';

export { toast, useToastStore } from './toastStore';
export type { ToastAction, ToastKind, ToastMessage, ToastOptions } from './toastStore';

/** Distance above the bottom inset so toasts clear the tab bar. */
const BOTTOM_OFFSET = 72;

function ToastView({ item }: { item: ToastMessage }) {
  const { colors } = useTheme();
  const dismiss = useToastStore((s) => s.dismiss);
  const reducedMotion = useReducedMotion();
  // Stable Animated.Value without reading a ref during render.
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: reducedMotion ? 0 : 150,
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(() => dismiss(item.id), item.durationMs);
    return () => clearTimeout(timer);
  }, [dismiss, item.durationMs, item.id, opacity, reducedMotion]);

  const accent =
    item.kind === 'error' ? colors.danger : item.kind === 'success' ? colors.accent : colors.border;

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      testID="toast"
      style={[
        styles.toast,
        { opacity, backgroundColor: colors.surfaceRaised, borderLeftColor: accent },
      ]}
    >
      <Text variant="body" style={styles.message}>
        {item.message}
      </Text>
      {item.action ? (
        <Pressable
          onPress={() => {
            item.action?.onPress();
            dismiss(item.id);
          }}
          accessibilityLabel={item.action.label}
          style={styles.action}
        >
          <Text variant="label" tone="accent">
            {item.action.label}
          </Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

/** Mount once near the root. Shows the oldest queued toast. */
export function ToastHost() {
  const current = useToastStore((s) => s.toasts[0]);
  const insets = useSafeAreaInsets();
  if (!current) return null;
  return (
    <View pointerEvents="box-none" style={[styles.host, { bottom: insets.bottom + BOTTOM_OFFSET }]}>
      <ToastView key={current.id} item={current} />
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: spacing.lg, right: spacing.lg, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 560,
    width: '100%',
    borderRadius: radius.tile,
    borderLeftWidth: 4,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    minHeight: 48,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  message: { flex: 1, paddingVertical: spacing.md },
  action: { justifyContent: 'center', paddingHorizontal: spacing.md },
});
