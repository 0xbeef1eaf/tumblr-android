import { ScrollView, StyleSheet, View } from 'react-native';

import { Icon, Pressable, Text, type IconName } from '@/ui/primitives';
import { spacing, useTheme } from '@/ui/theme';

import type { Suggestion } from './useSuggestions';

export interface SuggestionsProps {
  suggestions: readonly Suggestion[];
  onSelect: (suggestion: Suggestion) => void;
  onRemoveRecent: (suggestion: Extract<Suggestion, { kind: 'recent' }>) => void;
}

function describe(suggestion: Suggestion): { icon: IconName; label: string } {
  switch (suggestion.kind) {
    case 'tag':
      return { icon: 'pricetag-outline', label: `Tag: #${suggestion.value}` };
    case 'blog':
      return { icon: 'person-circle-outline', label: `Blog: ${suggestion.value}.tumblr.com` };
    case 'recent':
      return suggestion.entryType === 'tag'
        ? { icon: 'time-outline', label: `#${suggestion.value}` }
        : { icon: 'time-outline', label: `${suggestion.value}.tumblr.com` };
  }
}

/** Typing-state list: tag, blog and matching recents (DESIGN §3.3). */
export function Suggestions({ suggestions, onSelect, onRemoveRecent }: SuggestionsProps) {
  const { colors } = useTheme();
  return (
    <ScrollView keyboardShouldPersistTaps="handled" testID="suggestions">
      {suggestions.map((suggestion) => {
        const { icon, label } = describe(suggestion);
        return (
          <View key={suggestion.key} style={[styles.row, { borderBottomColor: colors.border }]}>
            <Pressable
              onPress={() => onSelect(suggestion)}
              accessibilityLabel={label}
              style={styles.main}
            >
              <Icon name={icon} size={20} tone="textSecondary" />
              <Text numberOfLines={1} style={styles.label}>
                {label}
              </Text>
            </Pressable>
            {suggestion.kind === 'recent' ? (
              <Pressable
                onPress={() => onRemoveRecent(suggestion)}
                accessibilityLabel={`Remove ${label}`}
              >
                <Icon name="close" size={18} tone="textSecondary" />
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  label: { flex: 1 },
});
