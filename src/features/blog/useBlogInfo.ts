import { useQuery } from '@tanstack/react-query';

import { getBlogInfo } from '@/api/endpoints/blog';
import { HOUR } from '@/lib/queryClient';

export function blogInfoQueryKey(name: string) {
  return ['blog', name, 'info'] as const;
}

/** `GET /blog/{name}/info`, cached for an hour. */
export function useBlogInfo(name: string) {
  return useQuery({
    queryKey: blogInfoQueryKey(name),
    queryFn: ({ signal }) => getBlogInfo(name, signal),
    staleTime: HOUR,
    enabled: name.length > 0,
  });
}
