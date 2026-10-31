import { Stack } from 'expo-router';
import { useCallback, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { useIsLiked, useToggleLike } from '@/features/auth';
import { MasonryGallery } from '@/features/gallery';
import { FilterRow, type KindFilter } from '@/features/search/FilterRow';
import { Icon, Pressable } from '@/ui/primitives';
import { useTheme } from '@/ui/theme';

import { MessageView } from './MessageView';
import { normalizeTag } from './normalizeTag';
import { TagEmptyState } from './TagEmptyState';
import { useTaggedPosts } from './useTaggedPosts';

export interface TagScreenProps {
  tag: string;
}

export function tagShareUrl(tag: string): string {
  return `https://www.tumblr.com/tagged/${encodeURIComponent(tag)}`;
}

/** `/tag/[tag]` — masonry gallery paginated by `before` (DESIGN §3.4). */
export function TagScreen({ tag: rawTag }: TagScreenProps) {
  const { colors } = useTheme();
  const tag = normalizeTag(rawTag);
  const [kind, setKind] = useState<KindFilter>('all');
  const paging = useTaggedPosts(tag);
  const onLike = useToggleLike();
  const isLiked = useIsLiked();

  const share = useCallback(() => {
    const url = tagShareUrl(tag);
    Share.share({ message: url, url }).catch(() => undefined);
  }, [tag]);

  const headerRight = useCallback(
    () => (
      <Pressable onPress={share} accessibilityLabel="Share tag" testID="share-tag">
        <Icon name="share-outline" size={22} />
      </Pressable>
    ),
    [share],
  );

  const failed = paging.error != null && paging.items.length === 0 && !paging.isLoading;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: `#${tag}`, headerRight }} />
      <FilterRow value={kind} onChange={setKind} />
      {failed ? (
        <MessageView
          icon="cloud-offline-outline"
          title="Couldn't load this tag"
          body="Check your connection and try again."
          actionLabel="Retry"
          onAction={() => void paging.refetch()}
          testID="tag-error"
        />
      ) : (
        <MasonryGallery
          items={paging.items}
          isLoading={paging.isLoading}
          isFetchingNextPage={paging.isFetchingNextPage}
          hasNextPage={paging.hasNextPage}
          onEndReached={() => void paging.fetchNextPage()}
          onRefresh={() => void paging.refetch()}
          isRefetching={paging.isRefetching}
          kindFilter={kind}
          onLike={onLike}
          isLiked={isLiked}
          emptyState={<TagEmptyState tag={tag} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
