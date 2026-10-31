import { useLocalSearchParams } from 'expo-router';

import { PlaceholderScreen } from '@/ui/PlaceholderScreen';

/** Post detail — placeholder (WP4). */
export default function PostScreen() {
  const { blog, id } = useLocalSearchParams<{ blog: string; id: string }>();
  return <PlaceholderScreen route="post/[blog]/[id]" detail={`${blog ?? ''} / ${id ?? ''}`} />;
}
