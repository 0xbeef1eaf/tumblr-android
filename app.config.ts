import type { ConfigContext, ExpoConfig } from 'expo/config';

import pkg from './package.json';

/** 0.1.0 → 100, 1.2.3 → 10203: Android needs a monotonically increasing integer per release. */
export function versionCodeFor(version: string): number {
  const [major = 0, minor = 0, patch = 0] = version
    .split('.')
    .map((n) => Number.parseInt(n, 10) || 0);
  return major * 10000 + minor * 100 + patch;
}

/**
 * Expo app config. EXPO_PUBLIC_* values are inlined into the bundle by Metro and are
 * also mirrored into `extra` so native/runtime code can read them via expo-constants.
 * Note: the New Architecture is mandatory in SDK 58, so `newArchEnabled` no longer exists.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Tumblr Gallery',
  slug: 'tumblr-gallery',
  version: pkg.version,
  scheme: 'tumblrgallery',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  backgroundColor: '#0f0f14',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.tumblrgallery.app',
  },
  android: {
    package: 'com.tumblrgallery.app',
    versionCode: versionCodeFor(pkg.version),
    adaptiveIcon: {
      backgroundColor: '#0f0f14',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    // Saving uses scoped MediaStore access via expo-media-library; legacy storage is not needed.
    blockedPermissions: [
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_MEDIA_AUDIO',
      'android.permission.ACCESS_MEDIA_LOCATION',
    ],
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-status-bar',
    'expo-secure-store',
    'expo-image',
    ['expo-video', { supportsBackgroundPlayback: false, supportsPictureInPicture: false }],
    [
      'expo-media-library',
      {
        photosPermission: 'Allow $(PRODUCT_NAME) to access your photos.',
        savePhotosPermission: 'Allow $(PRODUCT_NAME) to save images and videos to your photos.',
        isAccessMediaLocationEnabled: false,
        granularPermissions: ['photo', 'video'],
      },
    ],
    'expo-web-browser',
    'expo-sharing',
    'expo-font',
    [
      'expo-splash-screen',
      { image: './assets/splash-icon.png', imageWidth: 160, backgroundColor: '#0f0f14' },
    ],
  ],
  extra: {
    tumblrApiKey: process.env.EXPO_PUBLIC_TUMBLR_API_KEY,
    tokenExchangeUrl: process.env.EXPO_PUBLIC_TOKEN_EXCHANGE_URL,
    tumblrClientSecret: process.env.EXPO_PUBLIC_TUMBLR_CLIENT_SECRET,
  },
});
