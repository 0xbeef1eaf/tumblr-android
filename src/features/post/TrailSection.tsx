import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { NpfTrailItem } from '@/api/schemas/npf';
import { Icon, Pressable, Text } from '@/ui/primitives';
import { spacing, useTheme } from '@/ui/theme';

import { NpfRenderer } from './NpfRenderer';

export interface TrailSectionProps {
  trail: readonly NpfTrailItem[];
  width?: number;
  /** Start expanded (e.g. when the post's own content has no media, only the trail does). */
  defaultExpanded?: boolean;
}

const nameOf = (item: NpfTrailItem): string =>
  item.blog?.name ?? item.broken_blog_name ?? 'unknown';

/** Reblog trail: collapsed to "via blogname"; expand to read each earlier contribution. */
export function TrailSection({ trail, width, defaultExpanded = false }: TrailSectionProps) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const last = trail.at(-1);
  if (!last) return null;

  return (
    <View testID="trail-section" style={styles.root}>
      <Pressable
        onPress={() => setExpanded((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={expanded ? 'Collapse reblog trail' : 'Expand reblog trail'}
        style={styles.header}
      >
        <Icon name="repeat" size={18} tone="textSecondary" />
        <Text variant="label" tone="secondary" style={styles.flex}>
          via {nameOf(last)}
          {trail.length > 1 ? ` · ${trail.length} reblogs` : ''}
        </Text>
        <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={18} tone="textSecondary" />
      </Pressable>
      {expanded
        ? trail.map((item, index) => (
            <View
              // Trail order is fixed (oldest first).
              key={index}
              style={[styles.item, { borderLeftColor: colors.border }]}
              testID="trail-item"
            >
              <Text variant="label" style={styles.itemName}>
                {nameOf(item)}
              </Text>
              <NpfRenderer content={item.content} layout={item.layout} width={width} />
            </View>
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  flex: { flex: 1 },
  item: { marginTop: spacing.sm, borderLeftWidth: 2 },
  itemName: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
});
