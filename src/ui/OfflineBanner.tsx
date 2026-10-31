import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useNetworkState } from '@/lib/network';

import { Icon, Text } from './primitives';
import { spacing, useTheme } from './theme';

export const OFFLINE_MESSAGE = "You're offline — showing cached content";

/**
 * DESIGN §7 "Offline": a banner at the top of the app while the device has no connection.
 * Persisted gallery pages stay browsable underneath (react-query pauses, see queryClient).
 */
export function OfflineBanner() {
  const { isConnected, isLoading } = useNetworkState();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  if (isConnected || isLoading) return null;

  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={OFFLINE_MESSAGE}
      testID="offline-banner"
      style={[
        styles.banner,
        {
          paddingTop: insets.top + spacing.xs,
          backgroundColor: colors.surfaceRaised,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <Icon name="cloud-offline-outline" size={16} tone="textSecondary" />
      <Text variant="label" tone="secondary">
        {OFFLINE_MESSAGE}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
