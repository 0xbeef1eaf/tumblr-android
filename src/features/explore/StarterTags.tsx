import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { pickVariant } from '@/domain/media';
import { Pressable, Skeleton, Text } from '@/ui/primitives';
import { radius, spacing, useTheme } from '@/ui/theme';

import { STARTER_TAGS } from './starterTags';
import { PREVIEW_COUNT, useTagPreview } from './useTagPreview';

/** Delay between preview requests so ten cards never burst the rate budget. */
export const PREVIEW_STAGGER_MS = 250;

interface StarterTagCardProps {
  tag: string;
  /** Delay before this card's preview request starts. */
  delayMs: number;
}

export function StarterTagCard({ tag, delayMs }: StarterTagCardProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const [ready, setReady] = useState(delayMs <= 0);
  useEffect(() => {
    if (delayMs <= 0) return undefined;
    const timer = setTimeout(() => setReady(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  const preview = useTagPreview(tag, ready);
  const items = preview.data ?? [];
  const loading = !preview.isError && items.length === 0 && (!ready || preview.isLoading);

  return (
    <Pressable
      onPress={() => router.push(`/tag/${encodeURIComponent(tag)}`)}
      accessibilityLabel={`#${tag}`}
      testID={`starter-${tag}`}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Text variant="bodyStrong">{`#${tag}`}</Text>
      <View style={styles.strip}>
        {Array.from({ length: PREVIEW_COUNT }, (_, index) => {
          const item = items[index];
          return (
            <View key={index} style={styles.cell}>
              {item ? (
                <Image
                  source={{ uri: pickVariant(item.variants, 250)?.url }}
                  style={styles.image}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  accessibilityLabel={item.altText ?? `Image from ${item.blogName}`}
                  recyclingKey={item.id}
                />
              ) : loading ? (
                <Skeleton aspectRatio={1} radius={radius.sm} />
              ) : (
                <View style={[styles.image, { backgroundColor: colors.surfaceRaised }]} />
              )}
            </View>
          );
        })}
      </View>
    </Pressable>
  );
}

/** "Start here" section: the curated tags with lazy 3-up preview strips (DESIGN §3.1). */
export function StarterTags({ staggerMs = PREVIEW_STAGGER_MS }: { staggerMs?: number }) {
  return (
    <View style={styles.list} testID="starter-tags">
      {STARTER_TAGS.map((tag, index) => (
        <StarterTagCard key={tag} tag={tag} delayMs={index * staggerMs} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md, paddingHorizontal: spacing.md },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.sheet,
    borderWidth: StyleSheet.hairlineWidth,
  },
  strip: { flexDirection: 'row', gap: spacing.xs },
  cell: { flex: 1, aspectRatio: 1, borderRadius: radius.sm, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
});
