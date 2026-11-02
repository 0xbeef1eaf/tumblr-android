import { sessionController } from './sessionController';
import { useAuthStore, type SessionStatus, type SessionUser } from './authStore';

export interface Session {
  status: SessionStatus;
  user: SessionUser | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const signIn = () => sessionController.signIn();
const signOut = () => sessionController.signOut();

/**
 * Current session. `status` is `loading` while `useAuthBootstrap` restores tokens, then
 * `guest` or `signedIn`. `signIn` opens the Tumblr OAuth2 page in the in-app WebView;
 * `signOut` clears tokens and every user-scoped query.
 */
export function useSession(): Session {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  return { status, user, signIn, signOut };
}
