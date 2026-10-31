import { useLocalSearchParams } from 'expo-router';

import { BlogScreen } from '@/features/blog';

export default function BlogRoute() {
  const { name, tag } = useLocalSearchParams<{ name: string; tag?: string }>();
  return <BlogScreen name={name ?? ''} tag={tag || undefined} />;
}
