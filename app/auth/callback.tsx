import { PlaceholderScreen } from '@/ui/PlaceholderScreen';

/** OAuth redirect target (tumblrgallery://auth/callback) — placeholder (WP4). */
export default function AuthCallbackScreen() {
  return <PlaceholderScreen route="auth/callback" detail="Finishing sign-in…" />;
}
