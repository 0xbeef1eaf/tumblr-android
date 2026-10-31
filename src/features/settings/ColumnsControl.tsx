import { StyleSheet, View } from 'react-native';

import { Pressable, Text } from '@/ui/primitives';
import { radius, spacing, useTheme } from '@/ui/theme';

import type { GridColumns } from './settingsStore';

const OPTIONS: readonly GridColumns[] = [2, 3];

export interface ColumnsControlProps {
  value: GridColumns;
  onChange: (columns: GridColumns) => void;
}

/** Two-option segmented control for the gallery column count. */
export function ColumnsControl({ value, onChange }: ColumnsControlProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.group, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
      accessibilityRole="radiogroup"
      accessibilityLabel="Grid columns"
    >
      {OPTIONS.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            accessibilityRole="radio"
            accessibilityLabel={`${option} columns`}
            accessibilityState={{ selected }}
            style={[styles.segment, selected ? { backgroundColor: colors.accent } : null]}
            testID={`columns-${option}`}
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
});
