import { useCallback } from 'react';

import { toast } from '@/ui/primitives/toastStore';

import { useAuthStore, type SessionStatus, type SessionUser } from './authStore';

export interface Session {
  status: SessionStatus;
  user: SessionUser | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

/**
 * Current session. In WP1 nothing ever signs in, so this is always `{ status: 'guest' }`.
 * TODO(WP4): implement signIn (expo-auth-session → exchangeCode → secureTokenStore →
 * setTokenProvider → setSignedIn) and signOut (clear tokens, setGuest, clear user queries).
 */
export function useSession(): Session {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const setGuest = useAuthStore((s) => s.setGuest);

  const signIn = useCallback(async () => {
    toast.show('Signing in to Tumblr is coming soon.');
  }, []);

  const signOut = useCallback(async () => {
    setGuest();
  }, [setGuest]);

  return { status, user, signIn, signOut };
}
