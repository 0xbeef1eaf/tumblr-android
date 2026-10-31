import { create } from 'zustand';

export type ToastKind = 'info' | 'success' | 'error';

export interface ToastAction {
  label: string;
  onPress: () => void;
}

export interface ToastMessage {
  id: number;
  message: string;
  kind: ToastKind;
  durationMs: number;
  action?: ToastAction;
}

export interface ToastOptions {
  kind?: ToastKind;
  durationMs?: number;
  action?: ToastAction;
}

interface ToastState {
  toasts: ToastMessage[];
  show: (message: string, options?: ToastOptions) => number;
  dismiss: (id: number) => void;
  clear: () => void;
}

const DEFAULT_DURATION = 3000;
const MAX_QUEUE = 3;
let nextId = 1;

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  show: (message, options = {}) => {
    const id = nextId++;
    const toast: ToastMessage = {
      id,
      message,
      kind: options.kind ?? 'info',
      durationMs: options.durationMs ?? DEFAULT_DURATION,
      action: options.action,
    };
    // Identical consecutive messages (e.g. repeated 429s) are not stacked.
    set((state) =>
      state.toasts.at(-1)?.message === message
        ? state
        : { toasts: [...state.toasts, toast].slice(-MAX_QUEUE) },
    );
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

/** Imperative helpers usable outside React (mutations, query error handlers). */
export const toast = {
  show: (message: string, options?: ToastOptions) =>
    useToastStore.getState().show(message, options),
  success: (message: string, options?: Omit<ToastOptions, 'kind'>) =>
    useToastStore.getState().show(message, { ...options, kind: 'success' }),
  error: (message: string, options?: Omit<ToastOptions, 'kind'>) =>
    useToastStore.getState().show(message, { ...options, kind: 'error' }),
  dismiss: (id: number) => useToastStore.getState().dismiss(id),
};
