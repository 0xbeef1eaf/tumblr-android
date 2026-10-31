import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';

import { getBlogInfo } from '@/api/endpoints/blog';
import { reblog as reblogRequest } from '@/api/endpoints/user';
import type { GalleryItem } from '@/domain/galleryItem';
import { toast } from '@/ui/primitives/toastStore';

import { useAuthStore } from './authStore';
import { useUser } from './useUser';

export interface ReblogInput {
  item: GalleryItem;
  comment?: string;
  tags?: string[];
}

export interface ReblogState {
  /** Resolves `true` when the reblog succeeded. */
  reblog: (input: ReblogInput) => Promise<boolean>;
  isPending: boolean;
}

/** Reblog to the signed-in user's primary blog (comment + tags optional). */
export function useReblog(): ReblogState {
  const queryClient = useQueryClient();
  const signedIn = useAuthStore((s) => s.status === 'signedIn');
  const sessionBlog = useAuthStore((s) => s.user?.primaryBlog);
  const user = useUser();
  const targetBlog =
    sessionBlog ?? user.data?.blogs.find((b) => b.primary)?.name ?? user.data?.blogs[0]?.name;

  const mutation = useMutation({
    mutationFn: async ({ item, comment, tags }: ReblogInput) => {
      if (!targetBlog) throw new Error('No blog to reblog to');
      const parentTumblelogUuid =
        item.blogUuid ?? (await getBlogInfo(item.blogName)).uuid ?? item.blogName;
      return reblogRequest({
        blog: targetBlog,
        parentTumblelogUuid,
        parentPostId: item.postId,
        reblogKey: item.reblogKey,
        comment,
        tags,
      });
    },
    onSuccess: () => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
      toast.success(`Reblogged to ${targetBlog}`);
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: () => toast.error("Couldn't reblog this post"),
  });

  const { mutateAsync, isPending } = mutation;
  const reblog = useCallback(
    async (input: ReblogInput): Promise<boolean> => {
      if (!signedIn) {
        toast.show('Sign in to reblog');
        return false;
      }
      try {
        await mutateAsync(input);
        return true;
      } catch {
        return false;
      }
    },
    [signedIn, mutateAsync],
  );

  return { reblog, isPending };
}
