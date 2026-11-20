import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { isNotFoundError } from '@/api/errors';
import { useIsLiked, useToggleLike } from '@/features/auth';
import { ConnectAppCard } from '@/features/credentials/ConnectAppCard';
import { useApiKeyStatus } from '@/features/credentials/credentialsState';
import { MasonryGallery } from '@/features/gallery';
import { FilterRow, type KindFilter } from '@/features/search/FilterRow';
import { MessageView } from '@/features/tag/MessageView';
import { useTheme } from '@/ui/theme';

import { BlogHeader } from './BlogHeader';
import { TagChips } from './TagChips';
import { useBlogInfo } from './useBlogInfo';
import { useBlogPosts } from './useBlogPosts';

export interface BlogScreenProps {
  name: string;
  /** In-blog tag filter from `?tag=`. */
  tag?: string;
}

/** `/blog/[name]` — header, tag filter chips and a masonry gallery (DESIGN §3.5). */
export function BlogScreen({ name, tag }: BlogScreenProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const [kind, setKind] = useState<KindFilter>('all');
  const apiKey = useApiKeyStatus();
  // No consumer key: fire nothing and show the Connect card in place of the gallery.
  const info = useBlogInfo(name, apiKey.hasApiKey);
  const paging = useBlogPosts(name, tag, apiKey.hasApiKey);
  const onLike = useToggleLike();
  const isLiked = useIsLiked();

  const missing = isNotFoundError(info.error) || isNotFoundError(paging.error);
  const failed = !missing && paging.error != null && paging.items.length === 0;

  const header = (
    <View>
      <BlogHeader name={name} info={info.data} isLoading={info.isLoading} />
      <TagChips
        items={paging.items}
        selected={tag}
        onSelect={(next) => router.setParams({ tag: next })}
      />
      <FilterRow value={kind} onChange={setKind} />
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]} testID="blog-screen">
      <Stack.Screen options={{ title: info.data?.title || name }} />
      {apiKey.missing ? (
        <ConnectAppCard />
      ) : missing ? (
        <MessageView
          icon="eye-off-outline"
          title="This blog doesn't exist or is private"
          testID="blog-not-found"
        />
      ) : failed ? (
        <MessageView
          icon="cloud-offline-outline"
          title="Couldn't load this blog"
          body="Check your connection and try again."
          actionLabel="Retry"
          onAction={() => void paging.refetch()}
          testID="blog-error"
        />
      ) : (
        <MasonryGallery
          items={paging.items}
          isLoading={paging.isLoading || apiKey.loading}
          isFetchingNextPage={paging.isFetchingNextPage}
          hasNextPage={paging.hasNextPage}
          onEndReached={() => void paging.fetchNextPage()}
          onRefresh={() => void paging.refresh()}
          isRefetching={paging.isRefetching}
          header={header}
          kindFilter={kind}
          onLike={onLike}
          isLiked={isLiked}
          emptyState={
            <MessageView
              icon="images-outline"
              title={tag ? `No media tagged #${tag}` : 'No photos, GIFs or videos yet'}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
