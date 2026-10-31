import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { zustandStorage } from '@/lib/storage';

/**
 * Session state. Only non-secret data is persisted here (MMKV); tokens live in
 * SecureStore via `secureTokenStore` (src/api/auth.ts). WP4 extends this store with the
 * OAuth flow — keep the field names stable.
 */
export type SessionStatus = 'guest' | 'loading' | 'signedIn';

export interface SessionUser {
  name: string;
  primaryBlog?: string;
  primaryBlogUuid?: string;
  avatarUrl?: string;
}

export interface AuthState {
  status: SessionStatus;
  user: SessionUser | null;
  /** True when SecureStore is believed to hold tokens (a hint for bootstrapping). */
  hasStoredTokens: boolean;
  setLoading: () => void;
  setSignedIn: (user: SessionUser) => void;
  setUser: (user: SessionUser | null) => void;
  setGuest: () => void;
}

export const AUTH_STORE_KEY = 'tumblr-gallery.auth';

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      status: 'guest',
      user: null,
      hasStoredTokens: false,
      setLoading: () => set({ status: 'loading' }),
      setSignedIn: (user) => set({ status: 'signedIn', user, hasStoredTokens: true }),
      setUser: (user) => set({ user }),
      setGuest: () => set({ status: 'guest', user: null, hasStoredTokens: false }),
    }),
    {
      name: AUTH_STORE_KEY,
      version: 1,
      storage: createJSONStorage(() => zustandStorage),
      // `status` is never persisted: every launch starts as guest until tokens are verified.
      partialize: (state) => ({ user: state.user, hasStoredTokens: state.hasStoredTokens }),
    },
  ),
);
