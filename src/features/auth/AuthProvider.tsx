import { useQueryClient } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';

import { setTokenProvider } from '@/api/client';
import {
  bootstrapCredentials,
  useCredentialsBootstrap,
} from '@/features/credentials/credentialsState';

import { sessionController } from './sessionController';

/**
 * Loads the user's Tumblr app credentials, then restores the session from SecureStore (status
 * `loading` → `signedIn`/`guest`) and installs the token provider into the API client. Call
 * once, below the QueryClientProvider.
 */
export function useAuthBootstrap(): void {
  const queryClient = useQueryClient();
  useCredentialsBootstrap();
  useEffect(() => {
    sessionController.attachQueryClient(queryClient);
    setTokenProvider(sessionController.tokens);
    // Refreshing a stored token needs the consumer secret: credentials load first.
    void sessionController.bootstrap(bootstrapCredentials());
    return () => setTokenProvider(null);
  }, [queryClient]);
}

/** Component form of `useAuthBootstrap` for `app/_layout.tsx`. */
export function AuthProvider({ children }: { children?: ReactNode }) {
  useAuthBootstrap();
  return <>{children}</>;
}
