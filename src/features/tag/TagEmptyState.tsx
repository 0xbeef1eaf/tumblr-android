import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { STARTER_TAGS } from '@/features/explore/starterTags';
import { Chip } from '@/ui/primitives';
import { spacing } from '@/ui/theme';

import { MessageView } from './MessageView';

export interface TagEmptyStateProps {
  tag: string;
}

/** "Nothing tagged #x yet" + "Try: …" suggestions (DESIGN §7). */
export function TagEmptyState({ tag }: TagEmptyStateProps) {
  const router = useRouter();
  const suggestions = STARTER_TAGS.filter((t) => t !== tag.toLowerCase()).slice(0, 4);
  return (
    <MessageView
      icon="images-outline"
      title={`Nothing tagged #${tag} yet`}
      body="Try:"
      testID="tag-empty"
    >
      <View style={styles.chips}>
        {suggestions.map((suggestion) => (
          <Chip
            key={suggestion}
            label={`#${suggestion}`}
            onPress={() => router.push(`/tag/${encodeURIComponent(suggestion)}`)}
          />
        ))}
      </View>
    </MessageView>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
});
