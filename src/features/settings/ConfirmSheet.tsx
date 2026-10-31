import { StyleSheet, View } from 'react-native';

import { Pressable, Sheet, Text } from '@/ui/primitives';
import { radius, spacing, useTheme } from '@/ui/theme';

export interface ConfirmSheetProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  testID?: string;
}

/** Bottom-sheet confirmation for destructive storage actions. */
export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  testID = 'confirm-sheet',
}: ConfirmSheetProps) {
  const { colors } = useTheme();
  return (
    <Sheet visible={visible} onClose={onCancel} title={title} testID={testID}>
      <Text tone="secondary" style={styles.message}>
        {message}
      </Text>
      <View style={styles.actions}>
        <Pressable
          onPress={onCancel}
          accessibilityLabel="Cancel"
          style={[styles.button, { backgroundColor: colors.surface }]}
          testID={`${testID}-cancel`}
        >
          <Text variant="bodyStrong">Cancel</Text>
        </Pressable>
        <Pressable
          onPress={onConfirm}
          accessibilityLabel={confirmLabel}
          style={[styles.button, { backgroundColor: colors.danger }]}
          testID={`${testID}-confirm`}
        >
          <Text variant="bodyStrong" tone="onAccent">
            {confirmLabel}
          </Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  message: { marginBottom: spacing.lg },
  actions: { flexDirection: 'row', gap: spacing.md },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.chip,
    paddingVertical: spacing.sm,
  },
});
