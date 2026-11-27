import { Image } from 'expo-image';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { avatarUrl } from '@/api/endpoints/blog';
import type { TumblrNotification } from '@/api/schemas/notifications';
import { Icon, Pressable, Text } from '@/ui/primitives';
import { radius, spacing, useTheme } from '@/ui/theme';

import { describeNotification, fromBlog } from './notificationText';
import { relativeTime } from './relativeTime';

const AVATAR = 40;
const THUMB = 44;

export interface NotificationRowProps {
  notification: TumblrNotification;
  /** Row press; omitted when the notification leads nowhere. */
  onPress?: (notification: TumblrNotification) => void;
  onPressBlog: (name: string) => void;
  nowMs: number;
}

function NotificationRowInner({
  notification: n,
  onPress,
  onPressBlog,
  nowMs,
}: NotificationRowProps) {
  const { colors } = useTheme();
  const { actor, action, quote } = describeNotification(n);
  const blog = fromBlog(n);
  const avatar = n.from_tumblelog_avatar ?? (blog ? avatarUrl(blog, 64) : undefined);
  const thumbnail = n.target_media_url ?? n.media_url;
  const time = relativeTime(n.timestamp, nowMs);
  const sentence = actor ? `${actor} ${action}` : action;
  const label = `${sentence}${quote ? ` ${quote}` : ''}, ${time}${n.unread ? ', unread' : ''}`;

  return (
    <Pressable
      onPress={onPress ? () => onPress(n) : undefined}
      disabled={!onPress}
      accessibilityLabel={label}
      pressedOpacity={0.8}
      style={[styles.row, n.unread ? { backgroundColor: colors.surface } : null]}
      testID={`notification-${n.id}`}
    >
      <View style={styles.dotSlot}>
        {n.unread ? (
          <View style={[styles.dot, { backgroundColor: colors.accent }]} testID="unread-dot" />
        ) : null}
      </View>
      <Pressable
        onPress={blog ? () => onPressBlog(blog) : undefined}
        disabled={!blog}
        accessibilityLabel={blog ? `Open ${blog}` : actor || 'Notification'}
        noMinSize
        style={[styles.avatar, { backgroundColor: colors.surfaceRaised }]}
        testID={`notification-avatar-${n.id}`}
      >
        {avatar ? (
          <Image
            source={{ uri: avatar }}
            style={styles.avatar}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <Icon name="person-outline" size={20} tone="textSecondary" />
        )}
      </Pressable>
      <View style={styles.body}>
        <Text numberOfLines={3}>
          {actor ? (
            <>
              <Text variant="bodyStrong">{actor}</Text> {action}
            </>
          ) : (
            action
          )}
        </Text>
        {quote ? (
          <Text tone="secondary" numberOfLines={2}>
            {`“${quote}”`}
          </Text>
        ) : null}
        <Text variant="caption" tone="secondary">
          {time}
        </Text>
      </View>
      {thumbnail ? (
        <Image
          source={{ uri: thumbnail }}
          style={[styles.thumb, { backgroundColor: colors.surfaceRaised }]}
          contentFit="cover"
          cachePolicy="memory-disk"
          testID="notification-thumbnail"
        />
      ) : null}
    </Pressable>
  );
}

/** One activity row: avatar, "**blog** did something", age, thumbnail of your post. */
export const NotificationRow = memo(NotificationRowInner);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingRight: spacing.lg,
  },
  dotSlot: { width: spacing.md, alignItems: 'flex-end' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  body: { flex: 1, gap: spacing.xs / 2 },
  thumb: { width: THUMB, height: THUMB, borderRadius: radius.sm },
});
