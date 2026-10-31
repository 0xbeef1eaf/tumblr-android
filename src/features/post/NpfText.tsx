import * as Linking from 'expo-linking';
import { StyleSheet, Text as RNText, View, type TextStyle } from 'react-native';

import type { NpfTextBlock } from '@/api/schemas/npf';
import { Text, type TextVariant } from '@/ui/primitives';
import { fontSize, spacing, useTheme } from '@/ui/theme';

import { buildSegments, type TextSegment } from './npfText';

const SUBTYPE_VARIANT: Record<string, TextVariant> = {
  heading1: 'title',
  heading2: 'heading',
  quirky: 'heading',
};

function segmentStyle(segment: TextSegment, accent: string): TextStyle {
  const style: { -readonly [K in keyof TextStyle]: TextStyle[K] } = {};
  const decorations: string[] = [];
  for (const kind of segment.styles) {
    if (kind === 'bold') style.fontWeight = '700';
    if (kind === 'italic') style.fontStyle = 'italic';
    if (kind === 'small') style.fontSize = fontSize.sm;
    if (kind === 'strikethrough') decorations.push('line-through');
    if (kind === 'link') {
      style.color = accent;
      decorations.push('underline');
    }
    if (kind === 'mention') {
      style.color = accent;
      style.fontWeight = '600';
    }
    if (kind === 'color' && segment.color) style.color = segment.color;
  }
  if (decorations.length > 0) {
    style.textDecorationLine = decorations.join(' ') as TextStyle['textDecorationLine'];
  }
  return style;
}

export interface NpfTextProps {
  block: NpfTextBlock;
  /** 1-based position for consecutive `ordered-list-item` blocks. */
  listNumber?: number;
}

/** One NPF text block: subtype styling plus inline bold/italic/link… via nested `<Text>`. */
export function NpfText({ block, listNumber }: NpfTextProps) {
  const { colors } = useTheme();
  const subtype = block.subtype;
  const segments = buildSegments(block.text, block.formatting);
  if (segments.length === 0) return null;

  const indent = (block.indent_level ?? 0) * spacing.lg;
  const variant = (subtype && SUBTYPE_VARIANT[subtype]) || 'body';
  const bullet =
    subtype === 'unordered-list-item'
      ? '•'
      : subtype === 'ordered-list-item'
        ? `${listNumber ?? 1}.`
        : undefined;

  const body = (
    <Text
      variant={variant}
      testID="npf-text-content"
      selectable
      style={[
        subtype === 'quote' ? styles.quote : null,
        subtype === 'chat' ? styles.chat : null,
        subtype === 'indented' ? styles.indented : null,
        bullet ? styles.flex : null,
      ]}
    >
      {segments.map((segment, index) => (
        <RNText
          // Segments are positional and never reorder.
          key={index}
          testID="npf-segment"
          style={segmentStyle(segment, colors.accent)}
          onPress={segment.url ? () => void Linking.openURL(segment.url as string) : undefined}
          accessibilityRole={segment.url ? 'link' : undefined}
        >
          {segment.text}
        </RNText>
      ))}
    </Text>
  );

  return (
    <View
      testID={`npf-text-${subtype ?? 'body'}`}
      style={[
        styles.block,
        { paddingLeft: spacing.lg + indent },
        subtype === 'quote' ? { borderLeftColor: colors.border, borderLeftWidth: 3 } : null,
        bullet ? styles.row : null,
      ]}
    >
      {bullet ? (
        <Text variant="body" tone="secondary" style={styles.bullet}>
          {bullet}
        </Text>
      ) : null}
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { paddingRight: spacing.lg, paddingVertical: spacing.xs },
  row: { flexDirection: 'row' },
  flex: { flex: 1 },
  bullet: { width: 24 },
  quote: { fontStyle: 'italic', paddingLeft: spacing.sm },
  chat: { fontFamily: 'monospace' },
  indented: { paddingLeft: spacing.md },
});
