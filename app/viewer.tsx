import { LikeButton, useEnsureLiked } from '@/features/auth';
import { ViewerScreen } from '@/features/viewer';

/** Full-screen media viewer (transparent modal, DESIGN §3.7); double tap likes. */
export default function Viewer() {
  const ensureLiked = useEnsureLiked();
  return (
    <ViewerScreen
      renderLike={(item) => <LikeButton item={item} color="#ffffff" />}
      onDoubleTap={ensureLiked}
    />
  );
}
