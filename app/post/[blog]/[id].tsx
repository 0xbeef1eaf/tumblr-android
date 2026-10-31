import { useLocalSearchParams } from 'expo-router';

import { PostDetailScreen } from '@/features/post';

export default function PostScreen() {
  const { blog, id } = useLocalSearchParams<{ blog: string; id: string }>();
  return <PostDetailScreen blog={blog ?? ''} id={id ?? ''} />;
}
