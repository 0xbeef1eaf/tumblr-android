import { MISSING_KEY_MESSAGE, MISSING_SECRET_MESSAGE, createMemoryTokenStore } from '@/api/auth';
import { credentialsStore } from '@/api/credentials';
import { useToastStore } from '@/ui/primitives/toastStore';

import { useAuthStore } from './authStore';
import { createSessionController } from './sessionController';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (path: string) => mockPush(path) } }));

function setup() {
  const authorize = jest.fn(async () => ({ status: 'cancelled' as const }));
  const controller = createSessionController({
    store: createMemoryTokenStore(),
    authorize,
    fetchUser: jest.fn(),
  });
  return { controller, authorize };
}

beforeEach(() => {
  useAuthStore.getState().setGuest();
  useToastStore.getState().clear();
});

describe('sign-in preflight', () => {
  it('points to Settings when there is a key but no secret and no proxy', async () => {
    const { controller, authorize } = setup();
    await controller.signIn();
    expect(authorize).not.toHaveBeenCalled();
    const last = useToastStore.getState().toasts.at(-1);
    expect(last).toMatchObject({ kind: 'error', message: MISSING_SECRET_MESSAGE });
    last?.action?.onPress();
    expect(mockPush).toHaveBeenCalledWith('/settings');
    expect(useAuthStore.getState().status).toBe('guest');
  });

  it('asks for key and secret when nothing is configured', async () => {
    await credentialsStore.clear();
    const { controller, authorize } = setup();
    await controller.signIn();
    expect(authorize).not.toHaveBeenCalled();
    expect(useToastStore.getState().toasts.at(-1)?.message).toBe(MISSING_KEY_MESSAGE);
  });

  it('opens the browser once a consumer secret is saved', async () => {
    await credentialsStore.save({ consumerKey: 'k', consumerSecret: 's' });
    const { controller, authorize } = setup();
    await controller.signIn();
    expect(authorize).toHaveBeenCalledTimes(1);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});
