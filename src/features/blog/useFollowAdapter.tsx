import * as authModule from '@/features/auth';
import { useSession } from '@/features/auth';

/** Shape of WP4's `useFollow(blogName)` hook. */
export type UseFollowHook = (blogName: string) => {
  isFollowing: boolean;
  toggle: () => unknown;
  isPending: boolean;
};

/**
 * WP4 adds `useFollow` to `@/features/auth`. Resolve it at call time so the blog screen
 * degrades to "no Follow button" when the export is missing (and in tests that mock it).
 */
export function resolveFollowHook(): UseFollowHook | undefined {
  const candidate = (authModule as unknown as Record<string, unknown>).useFollow;
  return typeof candidate === 'function' ? (candidate as UseFollowHook) : undefined;
}

/** The Follow hook, only when the user is signed in and the export exists. */
export function useFollowAvailability(): UseFollowHook | undefined {
  const { status } = useSession();
  return status === 'signedIn' ? resolveFollowHook() : undefined;
}
