import { useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  asImageBlock,
  asTextBlock,
  asVideoBlock,
  type NpfBlock,
  type NpfLayout,
  type NpfMedia,
} from '@/api/schemas/npf';
import { aspectOf, parsePlaceholderColor, sortVariants, type MediaVariant } from '@/domain/media';
import { Pressable, Text } from '@/ui/primitives';
import { spacing } from '@/ui/theme';

import { ImageView, VideoPoster } from './MediaViews';
import { NpfLinkBlockSchema, NpfLinkCard } from './NpfLinkCard';
import { NpfText } from './NpfText';
import { buildRows, truncateAfter, truncateRows, type BlockRow } from './npfLayout';

/** Gap between side-by-side images (dp). */
export const ROW_GAP = 2;

export interface NpfRendererProps {
  content: readonly NpfBlock[];
  layout?: readonly NpfLayout[];
  /** Full width available (defaults to the window width). */
  width?: number;
  /** Honour `truncate_after` with a "Read more" button (default true). */
  truncate?: boolean;
  /** Called with the block index when an image is tapped (e.g. to open the viewer). */
  onMediaPress?: (blockIndex: number) => void;
}

function variantsOf(media: readonly NpfMedia[]): { variants: MediaVariant[]; aspect: number } {
  const usable = media.filter((m) => m.cropped !== true);
  const reference = usable.find((m) => m.has_original_dimensions) ?? usable[0];
  const aspect = aspectOf(reference?.width, reference?.height);
  const variants = sortVariants(
    usable.map((m) => ({ url: m.url, width: m.width ?? 0, height: m.height ?? 0, type: m.type })),
    aspect,
  );
  return { variants, aspect };
}

interface BlockViewProps {
  block: NpfBlock;
  index: number;
  width: number;
  listNumber?: number;
  onMediaPress?: (blockIndex: number) => void;
}

function BlockView({ block, index, width, listNumber, onMediaPress }: BlockViewProps) {
  const text = asTextBlock(block);
  if (text) return <NpfText block={text} listNumber={listNumber} />;

  const image = asImageBlock(block);
  if (image) {
    const { variants, aspect } = variantsOf(image.media);
    return (
      <ImageView
        variants={variants}
        aspectRatio={aspect}
        width={width}
        placeholderColor={parsePlaceholderColor(image.colors?.c0)}
        altText={image.alt_text}
        onPress={onMediaPress ? () => onMediaPress(index) : undefined}
      />
    );
  }

  const video = asVideoBlock(block);
  if (video) {
    const media = Array.isArray(video.media) ? video.media[0] : video.media;
    const { variants: poster, aspect: posterAspect } = variantsOf(video.poster ?? []);
    const native = (video.provider ?? (media ? 'tumblr' : undefined)) === 'tumblr';
    const videoUrl = native ? (media?.url ?? video.url) : undefined;
    return (
      <VideoPoster
        poster={poster}
        aspectRatio={
          media?.width && media.height ? aspectOf(media.width, media.height) : posterAspect
        }
        width={width}
        videoUrl={videoUrl}
        externalUrl={video.url ?? video.embed_url}
      />
    );
  }

  const link = NpfLinkBlockSchema.safeParse(block);
  if (link.success) return <NpfLinkCard block={link.data} />;
  return null; // audio, paywall and future block types
}

/**
 * Renders NPF `content` + `layout`: text (subtype styles, inline formatting), images
 * (full width, or equal-width side by side per `rows`), videos, link cards, and a
 * "Read more" cut-off at `truncate_after`.
 */
export function NpfRenderer({
  content,
  layout = [],
  width,
  truncate = true,
  onMediaPress,
}: NpfRendererProps) {
  const window = useWindowDimensions();
  const fullWidth = width ?? window.width;
  const [expanded, setExpanded] = useState(false);

  const allRows = useMemo(() => buildRows(content, layout), [content, layout]);
  const cutoff = truncate ? truncateAfter(layout) : undefined;
  const isTruncated = cutoff !== undefined && !expanded && cutoff < content.length - 1;
  const rows: BlockRow[] = isTruncated ? truncateRows(allRows, cutoff) : allRows;

  // Consecutive ordered-list items are numbered 1, 2, 3…
  const listNumbers = useMemo(() => {
    const numbers = new Map<number, number>();
    let current = 0;
    content.forEach((block, index) => {
      const text = asTextBlock(block);
      current = text?.subtype === 'ordered-list-item' ? current + 1 : 0;
      if (current > 0) numbers.set(index, current);
    });
    return numbers;
  }, [content]);

  return (
    <View testID="npf-renderer" style={styles.root}>
      {rows.map((row) => {
        const slot = (fullWidth - ROW_GAP * (row.blocks.length - 1)) / row.blocks.length;
        return (
          <View key={row.blocks.join('-')} style={styles.row} testID="npf-row">
            {row.blocks.map((index) => (
              <View key={index} style={row.blocks.length > 1 ? { width: slot } : styles.single}>
                <BlockView
                  block={content[index] as NpfBlock}
                  index={index}
                  width={row.blocks.length > 1 ? slot : fullWidth}
                  listNumber={listNumbers.get(index)}
                  onMediaPress={onMediaPress}
                />
              </View>
            ))}
          </View>
        );
      })}
      {isTruncated ? (
        <Pressable
          onPress={() => setExpanded(true)}
          accessibilityLabel="Read more"
          style={styles.more}
        >
          <Text variant="label" tone="accent">
            Read more
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: ROW_GAP },
  row: { flexDirection: 'row', gap: ROW_GAP, alignItems: 'flex-start' },
  single: { flex: 1 },
  more: { paddingHorizontal: spacing.lg, justifyContent: 'center' },
});
