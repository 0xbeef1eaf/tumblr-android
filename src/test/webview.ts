import { createElement, useEffect } from 'react';
import { View, type NativeSyntheticEvent } from 'react-native';
import type { WebViewProps } from 'react-native-webview';
import type {
  ShouldStartLoadRequest,
  WebViewError,
  WebViewHttpError,
  WebViewNativeEvent,
} from 'react-native-webview/lib/WebViewTypes';

/**
 * `react-native-webview` stand-in (installed by `src/test/setup.ts`): renders a `View` and
 * records the props, so tests can drive `onShouldStartLoadWithRequest`, `onError`, … directly.
 */
let renders: WebViewProps[] = [];
let mounts = 0;

function MockWebView(props: WebViewProps) {
  renders.push(props);
  useEffect(() => {
    mounts += 1;
  }, []);
  return createElement(View, { testID: props.testID ?? 'webview' });
}

export const webViewMock = { __esModule: true, WebView: MockWebView, default: MockWebView };

/** Props of the most recent WebView render; throws if none has rendered. */
export function lastWebViewProps(): WebViewProps {
  const props = renders.at(-1);
  if (!props) throw new Error('No WebView has rendered');
  return props;
}

/** How many WebViews have mounted (a Retry remounts it). */
export function webViewMountCount(): number {
  return mounts;
}

export function resetWebViewMock(): void {
  renders = [];
  mounts = 0;
}

function nativeEvent(url: string): WebViewNativeEvent {
  return {
    url,
    loading: true,
    title: '',
    canGoBack: false,
    canGoForward: false,
    lockIdentifier: 0,
  };
}

function synthetic<T>(event: T): NativeSyntheticEvent<T> {
  return { nativeEvent: event } as NativeSyntheticEvent<T>;
}

/** The request `onShouldStartLoadWithRequest` receives for a top-frame navigation to `url`. */
export function loadRequest(url: string): ShouldStartLoadRequest {
  return { ...nativeEvent(url), navigationType: 'other', isTopFrame: true };
}

export function navigationEvent(url: string) {
  return synthetic({ ...nativeEvent(url), navigationType: 'other' as const });
}

export function errorEvent(url: string, description = 'net::ERR_INTERNET_DISCONNECTED') {
  return synthetic<WebViewError>({ ...nativeEvent(url), code: -2, description });
}

export function httpErrorEvent(url: string, statusCode: number) {
  return synthetic<WebViewHttpError>({
    ...nativeEvent(url),
    statusCode,
    description: 'HTTP error',
  });
}
