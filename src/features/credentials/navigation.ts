import { router } from 'expo-router';

export const SETTINGS_ROUTE = '/settings';

/** Imperative jump to the Settings tab (Tumblr API section), for toasts outside React. */
export function openSettings(): void {
  router.push(SETTINGS_ROUTE);
}
