import * as Haptics from 'expo-haptics';
import { ScrollView, StyleSheet } from 'react-native';

import { Chip } from '@/ui/primitives';
import { spacing } from '@/ui/theme';

export type KindFilter = 'all' | 'image' | 'gif' | 'video';

export const KIND_FILTERS: readonly { value: KindFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'image', label: 'Photos' },
  { value: 'gif', label: 'GIFs' },
  { value: 'video', label: 'Video' },
];

export interface FilterRowProps {
  value: KindFilter;
  onChange: (value: KindFilter) => void;
}

/** `All · Photos · GIFs · Video` client-side media filter (DESIGN §3.3). */
export function FilterRow({ value, onChange }: FilterRowProps) {
  const select = (next: KindFilter) => {
    if (next === value) return;
    // Haptics are best-effort: unsupported devices/emulators must never break the filter.
    Haptics.selectionAsync().catch(() => undefined);
    onChange(next);
  };
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroll}
      testID="filter-row"
    >
      {KIND_FILTERS.map((filter) => (
        <Chip
          key={filter.value}
          label={filter.label}
          selected={value === filter.value}
          onPress={() => select(filter.value)}
          style={styles.chip}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  row: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  chip: { minHeight: 36 },
});
