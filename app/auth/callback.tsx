import { useRouter } from 'expo-router';
import { maybeCompleteAuthSession } from 'expo-web-browser';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Text } from '@/ui/primitives';
import { spacing, useTheme } from '@/ui/theme';

/**
 * OAuth redirect target (tumblrgallery://auth/callback). expo-auth-session consumes the URL
 * itself; this screen only appears for the moment the deep link is routed, then returns to
 * the screen sign-in started from (or home when there is no history).
 */
export default function AuthCallbackScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  useEffect(() => {
    maybeCompleteAuthSession();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]} testID="auth-callback">
      <ActivityIndicator color={colors.accent} />
      <Text variant="caption" tone="secondary">
        Finishing sign-in…
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
});
