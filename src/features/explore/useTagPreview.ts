import { useQuery } from '@tanstack/react-query';

import { getTagged } from '@/api/endpoints/tagged';
import { normalizePosts, type GalleryItem } from '@/domain/galleryItem';
import { HOUR } from '@/lib/queryClient';

export const PREVIEW_COUNT = 3;

export function tagPreviewQueryKey(tag: string) {
  return ['tagged', tag, 'preview'] as const;
}

/** First few media items of a tag for the Explore card (1 call per tag, cached 1 h). */
export function useTagPreview(tag: string, enabled: boolean) {
  return useQuery({
    queryKey: tagPreviewQueryKey(tag),
    queryFn: async ({ signal }): Promise<GalleryItem[]> =>
      normalizePosts(await getTagged({ tag, limit: 6, signal })).slice(0, PREVIEW_COUNT),
    staleTime: HOUR,
    enabled,
  });
}
