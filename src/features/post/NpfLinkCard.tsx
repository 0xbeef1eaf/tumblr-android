import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { NpfMediaSchema } from '@/api/schemas/npf';
import { lenientArray, opt } from '@/api/schemas/util';
import { Pressable, Text } from '@/ui/primitives';
import { radius, spacing, useTheme } from '@/ui/theme';

import { resolveLink } from './npfText';

export const NpfLinkBlockSchema = z.looseObject({
  type: z.literal('link'),
  url: z.string(),
  title: opt(z.string()),
  description: opt(z.string()),
  site_name: opt(z.string()),
  display_url: opt(z.string()),
  poster: opt(lenientArray(NpfMediaSchema)),
});
export type NpfLinkBlock = z.infer<typeof NpfLinkBlockSchema>;

/** Link block as a tappable card (poster, title, site). Opens in the browser. */
export function NpfLinkCard({ block }: { block: NpfLinkBlock }) {
  const { colors } = useTheme();
  const url = resolveLink(block.url);
  const poster = block.poster?.[0]?.url;
  const host = block.site_name ?? block.display_url ?? safeHost(url);
  return (
    <Pressable
      onPress={() => void Linking.openURL(url)}
      accessibilityRole="link"
      accessibilityLabel={`Open link ${block.title ?? host}`}
      testID="npf-link-card"
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      {poster ? <Image source={{ uri: poster }} style={styles.poster} contentFit="cover" /> : null}
      <View style={styles.body}>
        <Text variant="bodyStrong" numberOfLines={2}>
          {block.title ?? host}
        </Text>
        {block.description ? (
          <Text variant="caption" tone="secondary" numberOfLines={2}>
            {block.description}
          </Text>
        ) : null}
        <Text variant="caption" tone="accent" numberOfLines={1}>
          {host}
        </Text>
      </View>
    </Pressable>
  );
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginVertical: spacing.xs,
    borderRadius: radius.tile,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  poster: { width: '100%', aspectRatio: 16 / 9 },
  body: { padding: spacing.md, gap: spacing.xs },
});
