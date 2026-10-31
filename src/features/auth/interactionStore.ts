import { create } from 'zustand';

/**
 * Optimistic like/follow state shared by every tile, viewer and screen (not persisted).
 * Keyed by post id / lower-cased blog name so a toggle in one place shows everywhere.
 */
export interface InteractionState {
  likes: Record<string, boolean>;
  follows: Record<string, boolean>;
  setLike: (postId: string, liked: boolean) => void;
  clearLike: (postId: string) => void;
  setFollow: (blogName: string, following: boolean) => void;
  clearFollow: (blogName: string) => void;
  reset: () => void;
}

export const followKey = (blogName: string): string =>
  blogName
    .trim()
    .toLowerCase()
    .replace(/\.tumblr\.com$/, '');

function without(record: Record<string, boolean>, key: string): Record<string, boolean> {
  const { [key]: _removed, ...rest } = record;
  return rest;
}

export const useInteractionStore = create<InteractionState>()((set) => ({
  likes: {},
  follows: {},
  setLike: (postId, liked) => set((s) => ({ likes: { ...s.likes, [postId]: liked } })),
  clearLike: (postId) => set((s) => ({ likes: without(s.likes, postId) })),
  setFollow: (blogName, following) =>
    set((s) => ({ follows: { ...s.follows, [followKey(blogName)]: following } })),
  clearFollow: (blogName) => set((s) => ({ follows: without(s.follows, followKey(blogName)) })),
  reset: () => set({ likes: {}, follows: {} }),
}));
