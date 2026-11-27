import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { getBlogInfo } from '@/api/endpoints/blog';
import { follow, unfollow } from '@/api/endpoints/user';
import { HOUR } from '@/lib/queryClient';
import { toast } from '@/ui/primitives/toastStore';

import { useAuthStore } from './authStore';
import { followKey, useInteractionStore } from './interactionStore';
import { FOLLOWING_QUERY_KEY, useFollowing } from './useFollowing';

export interface FollowState {
  isFollowing: boolean;
  toggle: () => void;
  isPending: boolean;
}

export interface FollowOptions {
  /**
   * Fetch `/blog/{name}/info` for its `followed` flag when the blog is not in the loaded
   * following list (default true). Lists of many blogs known not to be followed (Explore
   * suggestions) pass false to save one call per row.
   */
  lookupInfo?: boolean;
}

/** Tumblr's follow endpoints take a blog URL. */
const blogUrl = (name: string): string => {
  const bare = followKey(name);
  return bare.includes('.') ? bare : `${bare}.tumblr.com`;
};

/**
 * Follow state for one blog. Known from the user's following list, then the blog info's
 * `followed` flag; toggling is optimistic and invalidates `['following']`.
 * Guests get a "sign in" nudge instead.
 */
export function useFollow(
  blogName: string,
  { lookupInfo = true }: FollowOptions = {},
): FollowState {
  const queryClient = useQueryClient();
  const signedIn = useAuthStore((s) => s.status === 'signedIn');
  const key = followKey(blogName);
  const override = useInteractionStore((s) => s.follows[key]);
  const { blogs } = useFollowing();
  const info = useQuery({
    queryKey: ['blog', blogName, 'info'],
    queryFn: ({ signal }) => getBlogInfo(blogName, signal),
    enabled: signedIn && lookupInfo && blogName.length > 0,
    staleTime: HOUR,
  });

  const mutation = useMutation({
    mutationFn: (target: boolean) =>
      target ? follow(blogUrl(blogName)) : unfollow(blogUrl(blogName)),
    onMutate: (target) => {
      useInteractionStore.getState().setFollow(blogName, target);
    },
    onError: (_error, target) => {
      useInteractionStore.getState().setFollow(blogName, !target);
      toast.error(target ? `Couldn't follow ${blogName}` : `Couldn't unfollow ${blogName}`);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: FOLLOWING_QUERY_KEY }),
  });

  const inList = blogs.some((b) => followKey(b.name) === key);
  const isFollowing = signedIn && (override ?? (inList || info.data?.followed === true));
  const { mutate, isPending } = mutation;

  const toggle = useCallback(() => {
    if (!signedIn) {
      toast.show('Sign in to follow blogs');
      return;
    }
    if (isPending) return;
    mutate(!isFollowing);
  }, [signedIn, isPending, mutate, isFollowing]);

  return { isFollowing, toggle, isPending };
}
