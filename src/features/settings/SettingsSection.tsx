import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/ui/primitives';
import { radius, spacing, useTheme } from '@/ui/theme';

export interface SettingsSectionProps {
  title: string;
  children: ReactNode;
  testID?: string;
}

/** A titled card that groups related settings rows. */
export function SettingsSection({ title, children, testID }: SettingsSectionProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.section} testID={testID}>
      <Text variant="label" tone="secondary" accessibilityRole="header" style={styles.title}>
        {title.toUpperCase()}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.xl },
  title: { marginBottom: spacing.sm, paddingHorizontal: spacing.lg },
  card: { borderRadius: radius.sheet, overflow: 'hidden' },
});
