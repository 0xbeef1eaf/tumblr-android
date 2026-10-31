import { useLocalSearchParams } from 'expo-router';

import { PlaceholderScreen } from '@/ui/PlaceholderScreen';

/** Tag gallery — placeholder (WP3). */
export default function TagScreen() {
  const { tag } = useLocalSearchParams<{ tag: string }>();
  return <PlaceholderScreen route="tag/[tag]" detail={`#${tag ?? ''}`} />;
}
