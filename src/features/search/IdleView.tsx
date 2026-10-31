import { ScrollView, StyleSheet, View } from 'react-native';

import { Icon, Pressable, Text } from '@/ui/primitives';
import { spacing } from '@/ui/theme';

import { useSearchHistoryStore, type SearchHistoryEntry } from './searchHistoryStore';

export interface IdleViewProps {
  onPick: (entry: SearchHistoryEntry) => void;
}

/** Idle state: the search hint plus the recent searches (removable, clearable). */
export function IdleView({ onPick }: IdleViewProps) {
  const entries = useSearchHistoryStore((state) => state.entries);
  const remove = useSearchHistoryStore((state) => state.remove);
  const clear = useSearchHistoryStore((state) => state.clear);

  return (
    <ScrollView keyboardShouldPersistTaps="handled" testID="search-idle">
      <View style={styles.hint}>
        <Icon name="search-outline" size={40} tone="textSecondary" />
        <Text tone="secondary" align="center">
          Search tags and blogs
        </Text>
      </View>
      {entries.length > 0 ? (
        <View>
          <View style={styles.header}>
            <Text variant="label" tone="secondary">
              Recent
            </Text>
            <Pressable onPress={clear} accessibilityLabel="Clear recent searches" noMinSize>
              <Text variant="label" tone="accent">
                Clear
              </Text>
            </Pressable>
          </View>
          {entries.map((entry) => {
            const label = entry.type === 'tag' ? `#${entry.value}` : `${entry.value}.tumblr.com`;
            return (
              <View key={`${entry.type}:${entry.value}`} style={styles.row}>
                <Pressable
                  onPress={() => onPick(entry)}
                  accessibilityLabel={label}
                  style={styles.main}
                >
                  <Icon name="time-outline" size={20} tone="textSecondary" />
                  <Text numberOfLines={1} style={styles.label}>
                    {label}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => remove(entry.type, entry.value)}
                  accessibilityLabel={`Remove ${label}`}
                >
                  <Icon name="close" size={18} tone="textSecondary" />
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hint: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  label: { flex: 1 },
});
