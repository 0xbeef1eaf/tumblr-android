import { Image } from 'expo-image';
import { useCallback, useState } from 'react';

import { useSearchHistoryStore } from '@/features/search';
import { toast } from '@/ui/primitives';

export type StorageAction = 'cache' | 'history';

export interface StorageActions {
  /** The action awaiting confirmation, if any. */
  pending: StorageAction | null;
  request: (action: StorageAction) => void;
  cancel: () => void;
  confirm: () => Promise<void>;
}

/** Confirm-then-run logic for the Storage section (image cache, search history). */
export function useStorageActions(): StorageActions {
  const [pending, setPending] = useState<StorageAction | null>(null);
  const clearHistory = useSearchHistoryStore((s) => s.clear);

  const cancel = useCallback(() => setPending(null), []);

  const confirm = useCallback(async () => {
    const action = pending;
    setPending(null);
    if (action === 'cache') {
      try {
        await Promise.all([Image.clearDiskCache(), Image.clearMemoryCache()]);
        toast.success('Image cache cleared');
      } catch {
        toast.error('Could not clear the image cache');
      }
    } else if (action === 'history') {
      clearHistory();
      toast.success('Search history cleared');
    }
  }, [pending, clearHistory]);

  return { pending, request: setPending, cancel, confirm };
}
