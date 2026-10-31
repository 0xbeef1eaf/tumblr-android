import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';

import { like, unlike } from '@/api/endpoints/user';
import type { GalleryItem } from '@/domain/galleryItem';
import { toast } from '@/ui/primitives/toastStore';

import { useAuthStore } from './authStore';
import { useBookmarksStore } from './bookmarksStore';
import { useInteractionStore } from './interactionStore';

export interface LikeState {
  liked: boolean;
  toggle: () => void;
  isPending: boolean;
}

interface LikeVariables {
  item: GalleryItem;
  /** The state to move to. */
  target: boolean;
}

function tick(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

/** Optimistic like/unlike: rolls back with a toast on failure, then refreshes `['likes']`. */
function useLikeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ item, target }: LikeVariables) => {
      const params = { id: item.postId, reblog_key: item.reblogKey };
      return target ? like(params) : unlike(params);
    },
    onMutate: ({ item, target }) => {
      useInteractionStore.getState().setLike(item.postId, target);
    },
    onError: (_error, { item, target }) => {
      useInteractionStore.getState().setLike(item.postId, !target);
      toast.error(target ? "Couldn't like this post" : "Couldn't remove the like");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['likes'] }),
  });
}

function toggleBookmark(item: GalleryItem): void {
  const saved = useBookmarksStore.getState().toggle(item);
  toast.show(saved ? 'Saved to Likes on this device' : 'Removed from Likes');
}

/**
 * Like state of one item. Signed in: optimistic toggle shared through `interactionStore`
 * (so every tile of the post updates). Guest: toggles a local bookmark instead.
 */
export function useLike(item: GalleryItem): LikeState {
  const signedIn = useAuthStore((s) => s.status === 'signedIn');
  const override = useInteractionStore((s) => s.likes[item.postId]);
  const bookmarked = useBookmarksStore((s) => s.items.some((b) => b.id === item.id));
  const { mutate, isPending } = useLikeMutation();

  const liked = signedIn ? (override ?? item.liked ?? false) : bookmarked;

  const toggle = useCallback(() => {
    tick();
    if (!signedIn) return toggleBookmark(item);
    if (isPending) return;
    mutate({ item, target: !liked });
  }, [signedIn, item, isPending, mutate, liked]);

  return { liked, toggle, isPending };
}

/**
 * Imperative variant for lists (`MasonryGallery`'s `onLike`): toggles whichever item it is
 * given, reading the current state at call time.
 */
export function useToggleLike(): (item: GalleryItem) => void {
  const { mutate } = useLikeMutation();
  return useCallback(
    (item: GalleryItem) => {
      tick();
      if (useAuthStore.getState().status !== 'signedIn') return toggleBookmark(item);
      const override = useInteractionStore.getState().likes[item.postId];
      mutate({ item, target: !(override ?? item.liked ?? false) });
    },
    [mutate],
  );
}
