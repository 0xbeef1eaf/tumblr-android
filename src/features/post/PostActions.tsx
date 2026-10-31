import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { useLike, useReblog, useSession } from '@/features/auth';
import type { GalleryItem } from '@/domain/galleryItem';
import { Icon, Pressable, Text, toast, type IconName } from '@/ui/primitives';
import { spacing, useTheme } from '@/ui/theme';

import { ReblogSheet } from './ReblogSheet';
import { saveMediaToLibrary, SavePermissionError } from './saveMedia';

export interface PostActionsProps {
  item: GalleryItem;
  /** Original-resolution media URLs for "Save". */
  mediaUrls: readonly string[];
}

interface ActionProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
}

function Action({ icon, label, onPress, active = false, disabled }: ActionProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled: Boolean(disabled) }}
      style={styles.action}
    >
      <Icon name={icon} size={24} color={active ? colors.like : colors.text} />
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
    </Pressable>
  );
}

/** Bottom action bar: Like, Reblog (confirm sheet), Share, Open in browser, Save. */
export function PostActions({ item, mediaUrls }: PostActionsProps) {
  const { colors } = useTheme();
  const { status, user } = useSession();
  const { liked, toggle, isPending: likePending } = useLike(item);
  const { reblog, isPending: reblogPending } = useReblog();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const onReblog = () => {
    if (status !== 'signedIn') {
      toast.show('Sign in to reblog');
      return;
    }
    setSheetOpen(true);
  };

  const onConfirmReblog = async ({ comment, tags }: { comment: string; tags: string[] }) => {
    const ok = await reblog({ item, comment, tags });
    if (ok) setSheetOpen(false);
  };

  const onShare = () => {
    if (!item.postUrl) return;
    void Share.share({ message: item.postUrl, url: item.postUrl }).catch(() => undefined);
  };

  const onOpen = () => {
    if (item.postUrl) void Linking.openURL(item.postUrl);
  };

  const onSave = async () => {
    if (saving || mediaUrls.length === 0) return;
    setSaving(true);
    try {
      const count = await saveMediaToLibrary(mediaUrls);
      toast.success(count === 1 ? 'Saved to your gallery' : `Saved ${count} items to your gallery`);
    } catch (error) {
      toast.error(
        error instanceof SavePermissionError
          ? 'Allow gallery access to save media'
          : "Couldn't save this media",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View
      testID="post-actions"
      style={[styles.bar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}
    >
      <Action
        icon={liked ? 'heart' : 'heart-outline'}
        label={liked ? 'Unlike' : 'Like'}
        onPress={toggle}
        active={liked}
        disabled={likePending}
      />
      <Action icon="repeat" label="Reblog" onPress={onReblog} />
      <Action icon="share-outline" label="Share" onPress={onShare} />
      <Action icon="open-outline" label="Open" onPress={onOpen} />
      <Action
        icon="download-outline"
        label="Save"
        onPress={() => void onSave()}
        disabled={saving || mediaUrls.length === 0}
      />
      <ReblogSheet
        visible={sheetOpen}
        blogName={user?.primaryBlog}
        isPending={reblogPending}
        onClose={() => setSheetOpen(false)}
        onConfirm={(input) => void onConfirmReblog(input)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  action: { alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: spacing.sm },
});
