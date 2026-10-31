import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useSearchHistoryStore } from '@/features/search/searchHistoryStore';
import { Chip, Text } from '@/ui/primitives';
import { spacing } from '@/ui/theme';

export const MAX_RECENT_CHIPS = 10;

/** "Recent" section: horizontally scrolling chips of the last 10 searches (DESIGN §3.1). */
export function RecentChips() {
  const router = useRouter();
  const entries = useSearchHistoryStore((state) => state.entries);
  if (entries.length === 0) return null;
  return (
    <View style={styles.section} testID="recent-chips">
      <Text variant="heading" style={styles.title}>
        Recent
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {entries.slice(0, MAX_RECENT_CHIPS).map((entry) => (
          <Chip
            key={`${entry.type}:${entry.value}`}
            label={entry.type === 'tag' ? `#${entry.value}` : entry.value}
            icon={entry.type === 'blog' ? 'person-circle-outline' : undefined}
            onPress={() =>
              router.push(
                entry.type === 'tag'
                  ? `/tag/${encodeURIComponent(entry.value)}`
                  : `/blog/${encodeURIComponent(entry.value)}`,
              )
            }
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  title: { paddingHorizontal: spacing.md },
  row: { gap: spacing.sm, paddingHorizontal: spacing.md },
});
