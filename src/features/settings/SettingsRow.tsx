import type { ReactNode } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { Pressable, Text, type TextTone } from '@/ui/primitives';
import { spacing, useTheme } from '@/ui/theme';

interface RowBaseProps {
  label: string;
  description?: string;
  /** Tone of the label; `danger` / `accent` are used for actions. */
  tone?: TextTone;
  testID?: string;
}

function RowText({ label, description, tone = 'primary' }: RowBaseProps) {
  return (
    <View style={styles.text}>
      <Text variant="body" tone={tone}>
        {label}
      </Text>
      {description ? (
        <Text variant="caption" tone="secondary">
          {description}
        </Text>
      ) : null}
    </View>
  );
}

export interface SettingsRowProps extends RowBaseProps {
  /** When set the whole row is a button. */
  onPress?: () => void;
  disabled?: boolean;
  /** Trailing content (value text, segmented control, …). */
  trailing?: ReactNode;
}

/** A single row: label + optional description, optionally pressable, optional trailing view. */
export function SettingsRow({
  label,
  description,
  tone,
  onPress,
  disabled,
  trailing,
  testID,
}: SettingsRowProps) {
  const content = (
    <>
      <RowText label={label} description={description} tone={tone} />
      {trailing}
    </>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={styles.row}
        accessibilityLabel={label}
        accessibilityHint={description}
        testID={testID}
      >
        {content}
      </Pressable>
    );
  }
  return (
    <View style={styles.row} testID={testID}>
      {content}
    </View>
  );
}

export interface SettingsSwitchRowProps extends RowBaseProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
}

/** A row with a trailing switch; the switch carries the accessible label. */
export function SettingsSwitchRow({
  label,
  description,
  value,
  onValueChange,
  testID,
}: SettingsSwitchRowProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.row} testID={testID}>
      <RowText label={label} description={description} />
      <Switch
        value={value}
        onValueChange={onValueChange}
        accessibilityLabel={label}
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
        trackColor={{ false: colors.border, true: colors.accent }}
        thumbColor={colors.surfaceRaised}
        testID={testID ? `${testID}-switch` : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 56,
  },
  text: { flex: 1, gap: 2 },
});
