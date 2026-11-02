import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider } from '@/features/auth';
import {
  installRateLimitToast,
  persistOptions,
  queryClient,
  useSyncOnlineManager,
} from '@/lib/queryClient';
import { navigationTheme } from '@/ui/navigationTheme';
import { OfflineBanner } from '@/ui/OfflineBanner';
import { toast, ToastHost } from '@/ui/primitives';
import { useTheme } from '@/ui/theme';

installRateLimitToast((message) => toast.show(message));

/** Deep links to modal routes (e.g. /viewer) still get the tabs underneath. */
export const unstable_settings = { anchor: '(tabs)' };

export default function RootLayout() {
  const theme = useTheme();
  const navTheme = useMemo(() => navigationTheme(theme), [theme]);
  useSyncOnlineManager();

  return (
    <GestureHandlerRootView style={styles.root}>
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <AuthProvider>
          <ThemeProvider value={navTheme}>
            <StatusBar style={theme.dark ? 'light' : 'dark'} />
            {/* In flow (not overlaid) so it never covers headers or search bars. */}
            <OfflineBanner />
            <Stack
              screenOptions={{
                headerTintColor: theme.colors.text,
                headerStyle: { backgroundColor: theme.colors.background },
                contentStyle: { backgroundColor: theme.colors.background },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="tag/[tag]" options={{ title: 'Tag' }} />
              <Stack.Screen name="blog/[name]" options={{ title: 'Blog' }} />
              <Stack.Screen name="post/[blog]/[id]" options={{ title: 'Post' }} />
              <Stack.Screen
                name="viewer"
                options={{
                  presentation: 'transparentModal',
                  headerShown: false,
                  animation: 'fade',
                  contentStyle: { backgroundColor: 'transparent' },
                }}
              />
              <Stack.Screen
                name="auth/sign-in"
                options={{ presentation: 'modal', headerShown: false, gestureEnabled: true }}
              />
              <Stack.Screen name="+not-found" options={{ title: 'Not found' }} />
            </Stack>
            <ToastHost />
          </ThemeProvider>
        </AuthProvider>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
