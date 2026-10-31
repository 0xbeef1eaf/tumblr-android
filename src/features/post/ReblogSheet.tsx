import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Pressable, Sheet, Text } from '@/ui/primitives';
import { fontSize, radius, spacing, useTheme } from '@/ui/theme';

export interface ReblogSheetProps {
  visible: boolean;
  blogName?: string;
  isPending: boolean;
  onClose: () => void;
  onConfirm: (input: { comment: string; tags: string[] }) => void;
}

/** "Tag1, #tag2  tag3" → ['tag1', 'tag2', 'tag3'] (comma separated; spaces kept inside a tag). */
export function parseTags(input: string): string[] {
  const tags = input
    .split(',')
    .map((tag) => tag.trim().replace(/^#+/, '').trim())
    .filter((tag) => tag.length > 0);
  return [...new Set(tags)];
}

/** Confirmation sheet for reblogging: optional comment and tags. */
export function ReblogSheet({
  visible,
  blogName,
  isPending,
  onClose,
  onConfirm,
}: ReblogSheetProps) {
  const { colors } = useTheme();
  const [comment, setComment] = useState('');
  const [tags, setTags] = useState('');
  const inputStyle = [
    styles.input,
    { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
  ];

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={blogName ? `Reblog to ${blogName}` : 'Reblog'}
    >
      <TextInput
        value={comment}
        onChangeText={setComment}
        placeholder="Add a comment (optional)"
        placeholderTextColor={colors.textSecondary}
        accessibilityLabel="Reblog comment"
        multiline
        style={[inputStyle, styles.comment]}
      />
      <TextInput
        value={tags}
        onChangeText={setTags}
        placeholder="Tags, separated by commas"
        placeholderTextColor={colors.textSecondary}
        accessibilityLabel="Reblog tags"
        autoCapitalize="none"
        style={inputStyle}
      />
      <View style={styles.actions}>
        <Pressable onPress={onClose} accessibilityLabel="Cancel" style={styles.button}>
          <Text variant="bodyStrong" tone="secondary">
            Cancel
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onConfirm({ comment: comment.trim(), tags: parseTags(tags) })}
          disabled={isPending}
          accessibilityLabel="Confirm reblog"
          style={[styles.button, styles.confirm, { backgroundColor: colors.accent }]}
        >
          <Text variant="bodyStrong" tone="onAccent">
            {isPending ? 'Reblogging…' : 'Reblog'}
          </Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.tile,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    marginBottom: spacing.md,
  },
  comment: { minHeight: 88, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md },
  button: { paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center' },
  confirm: { borderRadius: radius.chip },
});
