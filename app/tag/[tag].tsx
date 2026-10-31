import { useLocalSearchParams } from 'expo-router';

import { TagScreen } from '@/features/tag';

export default function TagRoute() {
  const { tag } = useLocalSearchParams<{ tag: string }>();
  return <TagScreen tag={tag ?? ''} />;
}
