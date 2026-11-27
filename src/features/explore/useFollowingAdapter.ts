import * as authModule from '@/features/auth';
import { useSession } from '@/features/auth';

/** Shape of WP4's `useFollowing()` hook. */
export type UseFollowingHook = () => {
  blogs: readonly { name: string; updated?: number }[] | undefined;
  /** `total_blogs` from Tumblr; absent in older mocks. */
  total?: number;
  isLoading: boolean;
};

/** Shape of `useFollow(blogName, options)`. */
export type UseFollowHook = (
  blogName: string,
  options?: { lookupInfo?: boolean },
) => { isFollowing: boolean; toggle: () => unknown; isPending: boolean };

function resolveAuthHook<T>(name: 'useFollowing' | 'useFollow'): T | undefined {
  const candidate = (authModule as unknown as Record<string, unknown>)[name];
  return typeof candidate === 'function' ? (candidate as T) : undefined;
}

/** WP4 adds `useFollowing` to `@/features/auth`; resolved at call time (see blog adapter). */
export function resolveFollowingHook(): UseFollowingHook | undefined {
  return resolveAuthHook<UseFollowingHook>('useFollowing');
}

/** `useFollow`, resolved the same way so tests that mock `@/features/auth` degrade to no button. */
export function resolveFollowHook(): UseFollowHook | undefined {
  return resolveAuthHook<UseFollowHook>('useFollow');
}

/** The hook, only for signed-in users and only when the export exists. */
export function useFollowingAvailability(): UseFollowingHook | undefined {
  const { status } = useSession();
  return status === 'signedIn' ? resolveFollowingHook() : undefined;
}
