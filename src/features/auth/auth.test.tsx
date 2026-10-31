import { act, renderHook } from '@testing-library/react-native';

import { appStorage } from '@/lib/storage';
import { useToastStore } from '@/ui/primitives/toastStore';

import { AUTH_STORE_KEY, useAuthStore } from './authStore';
import { useSession } from './useSession';

beforeEach(() => {
  useAuthStore.getState().setGuest();
  useToastStore.getState().clear();
});

describe('authStore', () => {
  it('starts as guest', () => {
    expect(useAuthStore.getState()).toMatchObject({ status: 'guest', user: null });
  });

  it('persists only non-secret fields (never status)', () => {
    useAuthStore.getState().setSignedIn({ name: 'pixelwanderer', primaryBlog: 'pixelwanderer' });
    const persisted = JSON.parse(appStorage.getString(AUTH_STORE_KEY) ?? '{}');
    expect(persisted.state).toEqual({
      user: { name: 'pixelwanderer', primaryBlog: 'pixelwanderer' },
      hasStoredTokens: true,
    });
    expect(JSON.stringify(persisted)).not.toMatch(/token"?:\s*"/i);
  });

  it('setGuest clears the user', () => {
    useAuthStore.getState().setSignedIn({ name: 'x' });
    useAuthStore.getState().setGuest();
    expect(useAuthStore.getState()).toMatchObject({
      status: 'guest',
      user: null,
      hasStoredTokens: false,
    });
  });
});

describe('useSession', () => {
  it('returns guest in WP1', async () => {
    const { result } = await renderHook(() => useSession());
    expect(result.current.status).toBe('guest');
    expect(result.current.user).toBeNull();
  });

  it('reflects the store and signs out', async () => {
    const { result } = await renderHook(() => useSession());
    await act(async () => {
      useAuthStore.getState().setSignedIn({ name: 'pixelwanderer' });
    });
    expect(result.current.status).toBe('signedIn');
    await act(async () => {
      await result.current.signOut();
    });
    expect(result.current.status).toBe('guest');
  });

  it('signIn is a stub that tells the user (WP4 implements it)', async () => {
    const { result } = await renderHook(() => useSession());
    await act(async () => {
      await result.current.signIn();
    });
    expect(useToastStore.getState().toasts[0]?.message).toMatch(/coming soon/i);
  });
});
