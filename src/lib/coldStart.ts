/** Where a launch without a deep link lands (DESIGN §2). */
export const COLD_START_PATH = '/dashboard';

/** Path part of a system URL: drops `scheme://host`, Expo Go's `/--` prefix, query and hash. */
function pathOf(url: string): string {
  const withoutOrigin = url.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]*/i, '');
  const path = withoutOrigin.split(/[?#]/)[0] ?? '';
  return path.replace(/^\/--(?=\/|$)/, '');
}

/**
 * `+native-intent` hook: on the initial launch, the root URL (what expo-router uses when the
 * app is opened from the launcher) goes to Dashboard; everything else is left alone, so `/`
 * still reaches Explore from inside the app and deep links keep their target.
 */
export function coldStartPath(path: string, initial: boolean): string {
  if (!initial) return path;
  const p = pathOf(path);
  return p === '' || p === '/' ? COLD_START_PATH : path;
}
