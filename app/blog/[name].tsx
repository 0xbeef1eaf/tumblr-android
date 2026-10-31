import { useLocalSearchParams } from 'expo-router';

import { PlaceholderScreen } from '@/ui/PlaceholderScreen';

/** Blog screen — placeholder (WP3). */
export default function BlogScreen() {
  const { name, tag } = useLocalSearchParams<{ name: string; tag?: string }>();
  return (
    <PlaceholderScreen route="blog/[name]" detail={tag ? `${name} · #${tag}` : (name ?? '')} />
  );
}
