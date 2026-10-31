import { ScrollView, StyleSheet } from 'react-native';

import type { GalleryItem } from '@/domain/galleryItem';
import { Chip } from '@/ui/primitives';
import { spacing } from '@/ui/theme';

export const MAX_TAG_CHIPS = 20;

/**
 * Tags seen across `items`, most frequent first (ties keep first-seen order), max 20.
 * Counting is case-insensitive; the first-seen spelling is displayed. A selected tag is
 * always included so it can be toggled off even when the filtered posts do not repeat it.
 */
export function aggregateTags(
  items: readonly GalleryItem[],
  selected?: string,
  max = MAX_TAG_CHIPS,
): string[] {
  const counts = new Map<string, { label: string; count: number }>();
  // Tags are per post: a multi-photo post must not count its tags once per photo.
  const seenPosts = new Set<string>();
  for (const item of items) {
    if (seenPosts.has(item.postId)) continue;
    seenPosts.add(item.postId);
    const seenKeys = new Set<string>();
    for (const raw of item.tags) {
      const label = raw.trim();
      const key = label.toLowerCase();
      if (!label || seenKeys.has(key)) continue;
      seenKeys.add(key);
      const entry = counts.get(key);
      if (entry) entry.count += 1;
      else counts.set(key, { label, count: 1 });
    }
  }
  const sorted = [...counts.values()]
    .map((entry, index) => ({ ...entry, index }))
    .sort((a, b) => b.count - a.count || a.index - b.index)
    .map((entry) => entry.label);
  const top = sorted.slice(0, max);
  const selectedKey = selected?.toLowerCase();
  if (selected && !top.some((t) => t.toLowerCase() === selectedKey)) {
    return [selected, ...top.slice(0, max - 1)];
  }
  return top;
}

export interface TagChipsProps {
  items: readonly GalleryItem[];
  selected?: string;
  /** Called with the tag to filter by, or `undefined` to clear the filter. */
  onSelect: (tag: string | undefined) => void;
}

/** Horizontal tag filter built from loaded posts; tapping the selected chip clears it. */
export function TagChips({ items, selected, onSelect }: TagChipsProps) {
  const tags = aggregateTags(items, selected);
  if (tags.length === 0) return null;
  const selectedKey = selected?.toLowerCase();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroll}
      testID="tag-chips"
    >
      {tags.map((tag) => {
        const isSelected = tag.toLowerCase() === selectedKey;
        return (
          <Chip
            key={tag.toLowerCase()}
            label={`#${tag}`}
            selected={isSelected}
            onPress={() => onSelect(isSelected ? undefined : tag)}
            style={styles.chip}
          />
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  row: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  chip: { minHeight: 36 },
});
