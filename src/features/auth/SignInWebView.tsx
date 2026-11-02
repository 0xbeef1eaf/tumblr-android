import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import type {
  ShouldStartLoadRequest,
  WebViewErrorEvent,
  WebViewHttpErrorEvent,
  WebViewNavigationEvent,
} from 'react-native-webview/lib/WebViewTypes';

import { Pressable, Text } from '@/ui/primitives';
import { spacing, useTheme } from '@/ui/theme';

import { isRedirectUrl, type OAuthFlowRequest } from './oauthFlowStore';

export const SIGN_IN_TITLE = 'Sign in to Tumblr';
export const LOAD_ERROR_MESSAGE =
  'Could not load the Tumblr sign-in page. Check your connection and try again.';

export function httpErrorMessage(status: number): string {
  return `Tumblr answered with an error (HTTP ${status}). Check the consumer key in Settings and try again.`;
}

export interface SignInWebViewProps {
  request: OAuthFlowRequest;
  /** Called once with the intercepted callback URL (it is never loaded). */
  onRedirect: (url: string) => void;
  onCancel: () => void;
}

/**
 * Tumblr's authorize page in an embedded WebView (DESIGN §3.8, ARCHITECTURE §7). The
 * navigation to `request.redirectUri` is blocked and handed to `onRedirect`: the callback URL
 * is only an identifier, nothing is served there.
 */
export function SignInWebView({ request, onRedirect, onCancel }: SignInWebViewProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false);

  const intercept = (url: string): boolean => {
    if (!isRedirectUrl(url, request.redirectUri)) return false;
    if (!done.current) {
      done.current = true;
      onRedirect(url);
    }
    return true;
  };

  const onShouldStartLoadWithRequest = ({ url }: ShouldStartLoadRequest) => !intercept(url);
  // Fallback for platforms that skip the hook for server redirects: still never show the page.
  const onLoadStart = ({ nativeEvent }: WebViewNavigationEvent) => {
    if (!intercept(nativeEvent.url)) setLoading(true);
  };
  const onError = ({ nativeEvent }: WebViewErrorEvent) => {
    if (isRedirectUrl(nativeEvent.url ?? '', request.redirectUri)) return;
    setError(LOAD_ERROR_MESSAGE);
  };
  const onHttpError = ({ nativeEvent }: WebViewHttpErrorEvent) => {
    if (isRedirectUrl(nativeEvent.url ?? '', request.redirectUri)) return;
    setError(httpErrorMessage(nativeEvent.statusCode));
  };
  const retry = () => {
    setError(null);
    setLoading(true);
    setAttempt((n) => n + 1);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]} testID="sign-in-webview">
      <View
        style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.border }]}
        testID="sign-in-header"
      >
        <Text variant="heading" style={styles.title} numberOfLines={1}>
          {SIGN_IN_TITLE}
        </Text>
        <Pressable
          onPress={onCancel}
          accessibilityLabel="Cancel sign-in"
          style={styles.cancel}
          testID="sign-in-cancel"
        >
          <Text variant="bodyStrong" tone="accent">
            Cancel
          </Text>
        </Pressable>
      </View>
      {error ? (
        <View style={styles.center} testID="sign-in-error">
          <Text variant="body" align="center">
            {error}
          </Text>
          <Pressable onPress={retry} style={styles.retry} testID="sign-in-retry">
            <Text variant="bodyStrong" tone="accent">
              Retry
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.body}>
          <WebView
            key={attempt}
            source={{ uri: request.url }}
            incognito={false}
            sharedCookiesEnabled
            onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
            onLoadStart={onLoadStart}
            onLoadEnd={() => setLoading(false)}
            onError={onError}
            onHttpError={onHttpError}
            style={[styles.body, { backgroundColor: colors.background }]}
            testID="sign-in-webview-content"
          />
          {loading ? (
            <View
              style={[StyleSheet.absoluteFill, styles.loading]}
              pointerEvents="none"
              testID="sign-in-loading"
            >
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { flex: 1 },
  cancel: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm },
  body: { flex: 1 },
  loading: { alignItems: 'center', justifyContent: 'center' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  retry: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
});
