import { create } from 'zustand';

interface RevealState {
  /** Post ids the user chose to reveal under safe mode; lives for the app session only. */
  revealed: ReadonlySet<string>;
  reveal: (postId: string) => void;
  reset: () => void;
}

export const useRevealStore = create<RevealState>()((set) => ({
  revealed: new Set<string>(),
  reveal: (postId) =>
    set((state) =>
      state.revealed.has(postId) ? state : { revealed: new Set([...state.revealed, postId]) },
    ),
  reset: () => set({ revealed: new Set<string>() }),
}));

export function useIsRevealed(postId: string): boolean {
  return useRevealStore((state) => state.revealed.has(postId));
}
