import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { avatarUrl } from '@/api/endpoints/blog';
import { Pressable, Skeleton, Text } from '@/ui/primitives';
import { radius, spacing, useTheme } from '@/ui/theme';

import { blogKey, formatVia, type SuggestedBlog } from './suggestions';
import {
  resolveFollowHook,
  useFollowingAvailability,
  type UseFollowHook,
  type UseFollowingHook,
} from './useFollowingAdapter';
import { useSuggestedBlogs } from './useSuggestedBlogs';

const AVATAR = 44;
/** Rows shown before "Show more". */
export const SUGGESTIONS_VISIBLE = 5;

interface RowFollowButtonProps {
  blogName: string;
  /** Check `/blog/{name}/info` too: the exclusion window may have missed this blog. */
  lookupInfo: boolean;
  useFollowHook: UseFollowHook;
  onFollow: (blogName: string) => void;
}

/**
 * Like the blog screen's FollowButton. Its `/info` lookup runs only when the user follows more
 * blogs than were read for exclusion; otherwise suggestions are known not to be followed.
 */
function RowFollowButton({ blogName, lookupInfo, useFollowHook, onFollow }: RowFollowButtonProps) {
  const { colors } = useTheme();
  const { isFollowing, toggle, isPending } = useFollowHook(blogName, { lookupInfo });
  return (
    <Pressable
      onPress={() => {
        if (!isFollowing) onFollow(blogName);
        void toggle();
      }}
      disabled={isPending}
      accessibilityLabel={isFollowing ? `Unfollow ${blogName}` : `Follow ${blogName}`}
      testID={`suggestion-follow-${blogName}`}
      style={[
        styles.follow,
        isFollowing
          ? { backgroundColor: colors.surface, borderColor: colors.border }
          : { backgroundColor: colors.accent, borderColor: colors.accent },
      ]}
    >
      <Text variant="label" tone={isFollowing ? 'primary' : 'onAccent'}>
        {isFollowing ? 'Following' : 'Follow'}
      </Text>
    </Pressable>
  );
}

interface SuggestionRowProps {
  blog: SuggestedBlog;
  lookupInfo: boolean;
  useFollowHook: UseFollowHook | undefined;
  onFollow: (blogName: string) => void;
}

function SuggestionRow({ blog, lookupInfo, useFollowHook, onFollow }: SuggestionRowProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const via = formatVia(blog.via);
  return (
    <View style={styles.row} testID={`suggestion-${blog.name}`}>
      <Pressable
        onPress={() => router.push(`/blog/${encodeURIComponent(blog.name)}`)}
        accessibilityLabel={`${blog.name}. ${via}`}
        style={styles.rowMain}
      >
        <Image
          source={{ uri: avatarUrl(blog.name, 64) }}
          style={[styles.avatar, { backgroundColor: colors.surface }]}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
        <View style={styles.rowText}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {blog.name}
          </Text>
          {blog.title && blog.title !== blog.name ? (
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {blog.title}
            </Text>
          ) : null}
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {via}
          </Text>
        </View>
      </Pressable>
      {useFollowHook ? (
        <RowFollowButton
          blogName={blog.name}
          lookupInfo={lookupInfo}
          useFollowHook={useFollowHook}
          onFollow={onFollow}
        />
      ) : null}
    </View>
  );
}

function SkeletonRow() {
  return (
    <View style={styles.row}>
      <Skeleton width={AVATAR} height={AVATAR} radius={AVATAR / 2} />
      <View style={styles.rowText}>
        <Skeleton width="50%" height={14} radius={radius.sm} />
        <Skeleton width="70%" height={12} radius={radius.sm} />
      </View>
    </View>
  );
}

function SuggestedBlogsInner({ useFollowingHook }: { useFollowingHook: UseFollowingHook }) {
  const { colors } = useTheme();
  const [followedHere, setFollowedHere] = useState<ReadonlySet<string>>(() => new Set());
  const [expanded, setExpanded] = useState(false);
  const { suggestions, isLoading, exclusionComplete } = useSuggestedBlogs(
    useFollowingHook,
    followedHere,
  );
  const useFollowHook = resolveFollowHook();
  const onFollow = useCallback(
    (name: string) => setFollowedHere((prev) => new Set(prev).add(blogKey(name))),
    [],
  );

  const loading = isLoading && suggestions.length === 0;
  if (!loading && suggestions.length === 0) return null;
  const visible = expanded ? suggestions : suggestions.slice(0, SUGGESTIONS_VISIBLE);
  return (
    <View style={styles.section} testID="suggested-blogs">
      <View style={styles.titles}>
        <Text variant="heading">Blogs you might like</Text>
        <Text variant="caption" tone="secondary">
          Followed by blogs you follow
        </Text>
      </View>
      <View style={styles.list}>
        {loading
          ? Array.from({ length: 3 }, (_, i) => <SkeletonRow key={i} />)
          : visible.map((blog) => (
              <SuggestionRow
                key={blog.name}
                blog={blog}
                lookupInfo={!exclusionComplete}
                useFollowHook={useFollowHook}
                onFollow={onFollow}
              />
            ))}
      </View>
      {!loading && suggestions.length > SUGGESTIONS_VISIBLE ? (
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          accessibilityLabel={expanded ? 'Show fewer blogs' : 'Show more blogs'}
          testID="suggested-blogs-more"
          style={[styles.more, { borderColor: colors.border }]}
        >
          <Text variant="label" tone="accent">
            {expanded ? 'Show fewer' : `Show ${suggestions.length - SUGGESTIONS_VISIBLE} more`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** "Blogs you might like" — who the blogs you follow follow. Signed-in only (DESIGN §3.1). */
export function SuggestedBlogs() {
  const useFollowingHook = useFollowingAvailability();
  if (!useFollowingHook) return null;
  return <SuggestedBlogsInner useFollowingHook={useFollowingHook} />;
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  titles: { paddingHorizontal: spacing.md },
  list: { paddingHorizontal: spacing.md, gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowText: { flex: 1, gap: 2 },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2 },
  follow: {
    borderRadius: radius.chip,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  more: {
    alignSelf: 'center',
    borderRadius: radius.chip,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
