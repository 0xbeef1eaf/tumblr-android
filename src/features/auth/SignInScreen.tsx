import { router, useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/ui/primitives';
import { spacing, useTheme } from '@/ui/theme';

import { useOAuthFlowStore } from './oauthFlowStore';
import { SignInWebView } from './SignInWebView';

type Nav = { canGoBack: () => boolean; goBack: () => void };

function leave(navigation: Nav) {
  if (navigation.canGoBack()) navigation.goBack();
  else router.replace('/');
}

/**
 * `/auth/sign-in` (modal): hosts the WebView for the flow `authorize()` published to
 * `useOAuthFlowStore`. Leaving the screen any way other than through the callback URL
 * (Cancel, back gesture, unmount) ends the flow as cancelled; after success that is a no-op.
 */
export function SignInScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  // The flow this screen was opened for; a later flow belongs to a later screen.
  const [request] = useState(() => useOAuthFlowStore.getState().request);
  const mounted = useRef(false);

  useEffect(() => {
    // Opened without a pending flow (deep link, process restore): nothing to sign in to.
    if (!request) {
      leave(navigation);
      return;
    }
    mounted.current = true;
    return () => {
      mounted.current = false;
      // Deferred so a StrictMode re-mount does not cancel the flow.
      setTimeout(() => {
        if (!mounted.current) useOAuthFlowStore.getState().cancel(request);
      }, 0);
    };
  }, [navigation, request]);

  if (!request) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.background }]} testID="sign-in-empty">
        <Text variant="body" tone="secondary" align="center">
          Nothing to sign in to.
        </Text>
      </View>
    );
  }

  return (
    <SignInWebView
      request={request}
      onRedirect={(url) => {
        useOAuthFlowStore.getState().complete(url);
        leave(navigation);
      }}
      onCancel={() => {
        useOAuthFlowStore.getState().cancel(request);
        leave(navigation);
      }}
    />
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
});
