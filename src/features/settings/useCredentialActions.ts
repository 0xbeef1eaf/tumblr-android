import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import type { TumblrCredentials } from '@/api/credentials';
import { useSession } from '@/features/auth';
import { useCredentialsStore } from '@/features/credentials/credentialsState';
import { toast } from '@/ui/primitives';

/** Everything fetched with the previous app's key or tokens. */
export const CREDENTIAL_SCOPED_QUERY_ROOTS = [
  'blog',
  'tagged',
  'post',
  'user',
  'dashboard',
  'likes',
  'following',
] as const;

const scoped = (query: { queryKey: readonly unknown[] }) =>
  typeof query.queryKey[0] === 'string' &&
  (CREDENTIAL_SCOPED_QUERY_ROOTS as readonly string[]).includes(query.queryKey[0]);

/** Drop cached pages; on-screen queries are reset (refetched, or idle without a key). */
export function clearCredentialScopedQueries(client: QueryClient): void {
  client.removeQueries({ predicate: scoped, type: 'inactive' });
  void client.resetQueries({ predicate: scoped, type: 'active' });
}

export interface CredentialActions {
  isSaving: boolean;
  /** Persist new credentials, sign out (tokens belong to the old app) and drop cached pages. */
  save: (credentials: TumblrCredentials) => Promise<boolean>;
  /** Forget the user's credentials, sign out and drop cached pages. */
  remove: () => Promise<boolean>;
}

export function useCredentialActions(): CredentialActions {
  const client = useQueryClient();
  const { signOut } = useSession();
  const setCredentials = useCredentialsStore((s) => s.setCredentials);
  const clearCredentials = useCredentialsStore((s) => s.clearCredentials);
  const [isSaving, setSaving] = useState(false);

  const apply = useCallback(
    async (change: () => Promise<unknown>, success: string, failure: string) => {
      setSaving(true);
      try {
        await change();
        await signOut();
        clearCredentialScopedQueries(client);
        toast.success(success);
        return true;
      } catch {
        toast.error(failure);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [client, signOut],
  );

  const save = useCallback(
    (credentials: TumblrCredentials) =>
      apply(
        () => setCredentials(credentials),
        'Credentials saved',
        'Could not save your credentials',
      ),
    [apply, setCredentials],
  );

  const remove = useCallback(
    () => apply(clearCredentials, 'Credentials removed', 'Could not remove your credentials'),
    [apply, clearCredentials],
  );

  return { isSaving, save, remove };
}
