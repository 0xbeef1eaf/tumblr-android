import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { GalleryItem } from '@/domain/galleryItem';
import { Icon, Pressable, Sheet, Text, type IconName } from '@/ui/primitives';
import { spacing } from '@/ui/theme';

import { copyItemLink, saveItem, shareItem } from './mediaActions';

export interface QuickActionsSheetProps {
  /** `null` hides the sheet. */
  item: GalleryItem | null;
  onClose: () => void;
  /** Wired by WP4; the Like row only renders when provided. */
  onLike?: (item: GalleryItem) => void;
}

interface Action {
  key: string;
  label: string;
  icon: IconName;
  run: (item: GalleryItem) => void;
}

export function openPost(item: Pick<GalleryItem, 'blogName' | 'postId'>) {
  router.push({ pathname: '/post/[blog]/[id]', params: { blog: item.blogName, id: item.postId } });
}

export function openBlog(blogName: string) {
  router.push({ pathname: '/blog/[name]', params: { name: blogName } });
}

function buildActions(item: GalleryItem, onLike?: (item: GalleryItem) => void): Action[] {
  const actions: Action[] = [
    { key: 'post', label: 'Open post', icon: 'document-text-outline', run: openPost },
    {
      key: 'blog',
      label: 'Open blog',
      icon: 'person-circle-outline',
      run: (i) => openBlog(i.blogName),
    },
  ];
  if (onLike) {
    actions.push({
      key: 'like',
      label: item.liked ? 'Unlike' : 'Like',
      icon: item.liked ? 'heart' : 'heart-outline',
      run: onLike,
    });
  }
  actions.push(
    { key: 'share', label: 'Share', icon: 'share-outline', run: (i) => void shareItem(i) },
    { key: 'copy', label: 'Copy link', icon: 'link-outline', run: (i) => void copyItemLink(i) },
    { key: 'save', label: 'Save', icon: 'download-outline', run: (i) => void saveItem(i) },
  );
  return actions;
}

/** Long-press quick actions for a tile (DESIGN §4). */
export function QuickActionsSheet({ item, onClose, onLike }: QuickActionsSheetProps) {
  return (
    <Sheet visible={item !== null} onClose={onClose} testID="quick-actions">
      {item ? (
        <View>
          <Text variant="label" tone="secondary" numberOfLines={1} style={styles.title}>
            {item.blogName}
          </Text>
          {buildActions(item, onLike).map((action) => (
            <Pressable
              key={action.key}
              accessibilityLabel={action.label}
              testID={`quick-action-${action.key}`}
              style={styles.row}
              onPress={() => {
                onClose();
                action.run(item);
              }}
            >
              <Icon name={action.icon} size={22} />
              <Text variant="body">{action.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.sm },
});
