import { useQueryClient } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';

import { setTokenProvider } from '@/api/client';

import { sessionController } from './sessionController';

/**
 * Restores the session from SecureStore (status `loading` → `signedIn`/`guest`) and installs
 * the token provider into the API client. Call once, below the QueryClientProvider.
 */
export function useAuthBootstrap(): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    sessionController.attachQueryClient(queryClient);
    setTokenProvider(sessionController.tokens);
    void sessionController.bootstrap();
    return () => setTokenProvider(null);
  }, [queryClient]);
}

/** Component form of `useAuthBootstrap` for `app/_layout.tsx`. */
export function AuthProvider({ children }: { children?: ReactNode }) {
  useAuthBootstrap();
  return <>{children}</>;
}
