import { StyleSheet, View } from 'react-native';

import { Pressable, Text } from '@/ui/primitives';
import { radius, spacing, useTheme } from '@/ui/theme';

export interface SegmentedControlProps<T extends number> {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  /** Accessibility label of the whole group, e.g. "Grid columns". */
  label: string;
  /** Accessibility label of one option, e.g. `(n) => `${n} columns``. */
  optionLabel: (option: T) => string;
  /** Options get the testID `${testIDPrefix}-${option}`. */
  testIDPrefix: string;
  /** Tighter segments for controls with many options. */
  compact?: boolean;
}

/** Single-choice segmented control over a short list of numbers. */
export function SegmentedControl<T extends number>({
  options,
  value,
  onChange,
  label,
  optionLabel,
  testIDPrefix,
  compact = false,
}: SegmentedControlProps<T>) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.group, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
    >
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            accessibilityRole="radio"
            accessibilityLabel={optionLabel(option)}
            accessibilityState={{ selected }}
            style={[
              styles.segment,
              compact ? styles.compact : null,
              selected ? { backgroundColor: colors.accent } : null,
            ]}
            testID={`${testIDPrefix}-${option}`}
          >
            <Text variant="label" tone={selected ? 'onAccent' : 'primary'}>
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    borderRadius: radius.chip,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  segment: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  compact: { paddingHorizontal: spacing.md },
});
