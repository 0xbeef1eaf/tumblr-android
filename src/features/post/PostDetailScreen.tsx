import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { avatarUrl } from '@/api/endpoints/blog';
import { isNotFoundError } from '@/api/errors';
import { isNpfPost, type Post } from '@/api/schemas/post';
import { normalizePost } from '@/domain/galleryItem';
import { useViewerStore } from '@/features/gallery';
import { Chip, Pressable, Skeleton, Text } from '@/ui/primitives';
import { radius, spacing, useTheme } from '@/ui/theme';

import { LegacyBody } from './LegacyBody';
import { NpfRenderer } from './NpfRenderer';
import { PostActions } from './PostActions';
import { itemIndexForBlock, postToItem } from './postItem';
import { TrailSection } from './TrailSection';
import { usePost } from './usePost';

export interface PostDetailScreenProps {
  blog: string;
  id: string;
}

export function formatPostDate(timestamp: number): string {
  if (!timestamp) return '';
  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function hasMedia(post: Post): boolean {
  return isNpfPost(post) && post.content.some((b) => b.type === 'image' || b.type === 'video');
}

function PostBody({ post, width }: { post: Post; width: number }) {
  const router = useRouter();
  const { colors } = useTheme();
  const mediaItems = useMemo(() => normalizePost(post), [post]);
  const rootBlog = post.reblogged_root_name;

  return (
    <ScrollView contentContainerStyle={styles.scroll} testID="post-detail">
      <Pressable
        onPress={() => router.push(`/blog/${post.blog_name}`)}
        accessibilityLabel={`Open blog ${post.blog_name}`}
        style={styles.header}
      >
        <Image source={{ uri: avatarUrl(post.blog_name, 64) }} style={styles.avatar} />
        <View style={styles.flex}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {post.blog_name}
          </Text>
          <Text variant="caption" tone="secondary">
            {formatPostDate(post.timestamp)}
          </Text>
        </View>
      </Pressable>

      {isNpfPost(post) ? (
        <>
          <NpfRenderer
            content={post.content}
            layout={post.layout}
            width={width}
            truncate={false}
            onMediaPress={(blockIndex) => {
              const block = post.content[blockIndex];
              const index = block ? itemIndexForBlock(mediaItems, block) : -1;
              if (index < 0) return;
              useViewerStore.getState().open(mediaItems, index);
              router.push('/viewer');
            }}
          />
          <TrailSection
            trail={post.trail}
            width={width}
            defaultExpanded={!hasMedia(post) && post.trail.length > 0}
          />
        </>
      ) : (
        <LegacyBody post={post} width={width} />
      )}

      {post.tags.length > 0 ? (
        <View style={styles.tags} testID="post-tags">
          {post.tags.map((tag) => (
            <Chip
              key={tag}
              label={`#${tag}`}
              onPress={() => router.push(`/tag/${encodeURIComponent(tag)}`)}
              accessibilityLabel={`Tag ${tag}`}
            />
          ))}
        </View>
      ) : null}

      <View style={styles.meta}>
        {post.note_count !== undefined ? (
          <Text variant="label" tone="secondary" testID="post-notes">
            {post.note_count.toLocaleString()} {post.note_count === 1 ? 'note' : 'notes'}
          </Text>
        ) : null}
        {rootBlog && rootBlog !== post.blog_name ? (
          <Pressable
            onPress={() => router.push(`/blog/${rootBlog}`)}
            accessibilityLabel={`Source blog ${rootBlog}`}
            noMinSize
          >
            <Text variant="label" style={{ color: colors.accent }}>
              Source: {rootBlog}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}

/** Post detail (DESIGN §3.6): all media, caption, trail, tags, notes and the action bar. */
export function PostDetailScreen({ blog, id }: PostDetailScreenProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const query = usePost(blog, id);
  const post = query.data;
  const item = useMemo(() => (post ? postToItem(post) : undefined), [post]);
  const mediaUrls = useMemo(
    () =>
      post
        ? normalizePost(post).flatMap((i) => {
            const url = i.kind === 'video' ? i.videoUrl : i.variants[0]?.url;
            return url ? [url] : [];
          })
        : [],
    [post],
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {query.isLoading ? (
        <View style={styles.loading} testID="post-loading">
          <Skeleton height={48} />
          <Skeleton aspectRatio={1} />
          <Skeleton height={16} width="70%" />
        </View>
      ) : query.isError || !post || !item ? (
        <View style={styles.center} testID="post-error">
          <Text variant="heading" align="center">
            {isNotFoundError(query.error)
              ? "This post doesn't exist or is private"
              : "Couldn't load this post"}
          </Text>
          {isNotFoundError(query.error) ? null : (
            <Pressable onPress={() => void query.refetch()} accessibilityLabel="Retry">
              <Text variant="bodyStrong" tone="accent">
                Try again
              </Text>
            </Pressable>
          )}
        </View>
      ) : (
        <>
          <PostBody post={post} width={width} />
          <PostActions item={item} mediaUrls={mediaUrls} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  scroll: { paddingBottom: spacing.xl, gap: spacing.sm },
  loading: { padding: spacing.lg, gap: spacing.md },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  avatar: { width: 40, height: 40, borderRadius: radius.chip },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.lg },
  meta: { paddingHorizontal: spacing.lg, gap: spacing.xs },
});
