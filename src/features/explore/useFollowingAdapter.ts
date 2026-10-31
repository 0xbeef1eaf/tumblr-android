import * as authModule from '@/features/auth';
import { useSession } from '@/features/auth';

/** Shape of WP4's `useFollowing()` hook. */
export type UseFollowingHook = () => {
  blogs: readonly { name: string }[] | undefined;
  isLoading: boolean;
};

/** WP4 adds `useFollowing` to `@/features/auth`; resolved at call time (see blog adapter). */
export function resolveFollowingHook(): UseFollowingHook | undefined {
  const candidate = (authModule as unknown as Record<string, unknown>).useFollowing;
  return typeof candidate === 'function' ? (candidate as UseFollowingHook) : undefined;
}

/** The hook, only for signed-in users and only when the export exists. */
export function useFollowingAvailability(): UseFollowingHook | undefined {
  const { status } = useSession();
  return status === 'signedIn' ? resolveFollowingHook() : undefined;
}
