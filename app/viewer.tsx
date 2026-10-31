import { LikeButton } from '@/features/auth';
import { ViewerScreen } from '@/features/viewer';

/** Full-screen media viewer (transparent modal, DESIGN §3.7). */
export default function Viewer() {
  return <ViewerScreen renderLike={(item) => <LikeButton item={item} color="#ffffff" />} />;
}
