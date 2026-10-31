import { useQuery } from '@tanstack/react-query';

import { getUserInfo } from '@/api/endpoints/user';
import { MINUTE } from '@/lib/queryClient';

import { useAuthStore } from './authStore';
import { toSessionUser } from './sessionUser';

export const USER_QUERY_KEY = ['user'] as const;

/** `/user/info` for the signed-in user (disabled for guests). Keeps the auth store in sync. */
export function useUser() {
  const signedIn = useAuthStore((s) => s.status === 'signedIn');
  return useQuery({
    queryKey: USER_QUERY_KEY,
    queryFn: async ({ signal }) => {
      const info = await getUserInfo(signal);
      useAuthStore.getState().setUser(toSessionUser(info));
      return info;
    },
    enabled: signedIn,
    staleTime: 10 * MINUTE,
  });
}
