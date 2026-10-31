import { StyleSheet, View } from 'react-native';

import { Icon, Pressable, Text, type IconName } from '@/ui/primitives';
import { spacing } from '@/ui/theme';

export interface MessageViewProps {
  icon: IconName;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
  children?: React.ReactNode;
}

/** Centered icon + title + optional body/action, for empty and error states (DESIGN §7). */
export function MessageView({
  icon,
  title,
  body,
  actionLabel,
  onAction,
  testID,
  children,
}: MessageViewProps) {
  return (
    <View style={styles.root} testID={testID}>
      <Icon name={icon} size={56} tone="textSecondary" />
      <Text variant="heading" align="center">
        {title}
      </Text>
      {body ? (
        <Text tone="secondary" align="center">
          {body}
        </Text>
      ) : null}
      {children}
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} accessibilityLabel={actionLabel} style={styles.action}>
          <Text variant="bodyStrong" tone="accent">
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    paddingTop: spacing.xxl,
  },
  action: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
});
