import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Modal, Pressable as RNPressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing, useTheme } from '../theme';
import { useReducedMotion } from '../useReducedMotion';

import { Text } from './Text';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children?: ReactNode;
  testID?: string;
}

const OFFSCREEN = 600;

/** Dependency-light bottom sheet: RN Modal + Animated slide/fade, tap scrim to close. */
export function Sheet({ visible, onClose, title, children, testID = 'sheet' }: SheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  // Stable Animated.Value without reading a ref during render.
  const [progress] = useState(() => new Animated.Value(0));
  const [mounted, setMounted] = useState(visible);
  // Mount immediately when opened (render-phase update); unmount after the exit animation.
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    const duration = reducedMotion ? 0 : visible ? 250 : 200;
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
    return () => animation.stop();
  }, [visible, progress, reducedMotion]);

  if (!mounted) return null;

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [OFFSCREEN, 0] });

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root} testID={testID}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: progress }]}>
          <RNPressable
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            testID={`${testID}-scrim`}
          />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.panel,
            {
              backgroundColor: colors.surfaceRaised,
              paddingBottom: insets.bottom + spacing.lg,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          {title ? (
            <Text variant="heading" style={styles.title} accessibilityRole="header">
              {title}
            </Text>
          ) : null}
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  panel: {
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: spacing.md,
  },
  title: { marginBottom: spacing.md },
});
