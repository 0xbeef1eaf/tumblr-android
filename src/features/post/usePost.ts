import { useQuery } from '@tanstack/react-query';

import { getPost } from '@/api/endpoints/posts';
import { MINUTE } from '@/lib/queryClient';

export const postQueryKey = (blog: string, id: string) => ['post', blog, id] as const;

/** One post by blog + id. Signed in uses the OAuth endpoint, guests fall back to `/posts?id=`. */
export function usePost(blog: string, id: string) {
  return useQuery({
    queryKey: postQueryKey(blog, id),
    queryFn: ({ signal }) => getPost(blog, id, { signal }),
    enabled: blog.length > 0 && id.length > 0,
    staleTime: 5 * MINUTE,
  });
}
