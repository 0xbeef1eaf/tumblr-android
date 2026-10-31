import { http, HttpResponse } from 'msw';
import { z } from 'zod';

import { apiFetch, configureApiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { API, fixtures, rateLimited, server } from '@/test/msw';

import {
  createQueryClient,
  createQueryPersister,
  installRateLimitToast,
  PERSIST_MAX_AGE,
  persistOptions,
  shouldPersistQuery,
  shouldRetry,
} from './queryClient';
import { createMemoryStore } from './storage';

const q = (queryKey: unknown[], status: 'success' | 'error' | 'pending' = 'success') =>
  ({ queryKey, state: { status } }) as unknown as Parameters<typeof shouldPersistQuery>[0];

describe('queryClient', () => {
  it.each([
    [['tagged', 'cats'], true],
    [['blog', 'staff', 'posts', {}], true],
    [['blog', 'staff', 'info'], true],
    [['dashboard'], true],
    [['likes'], true],
    [['user'], false],
    [['following'], false],
    [['post', 'staff', '1'], false],
    [['auth'], false],
  ])('persists %j → %p', (key, expected) => {
    expect(shouldPersistQuery(q(key))).toBe(expected);
  });

  it('never persists unsuccessful queries', () => {
    expect(shouldPersistQuery(q(['tagged', 'x'], 'error'))).toBe(false);
    expect(shouldPersistQuery(q(['tagged', 'x'], 'pending'))).toBe(false);
  });

  it.each([
    [0, new ApiError({ status: 404 }), false],
    [0, new ApiError({ status: 429 }), false],
    [0, new ApiError({ status: 503 }), true],
    [0, new TypeError('Network request failed'), true],
    [2, new TypeError('Network request failed'), false],
  ])('retry(%i, %p) → %p', (count, error, expected) => {
    expect(shouldRetry(count, error)).toBe(expected);
  });

  it('defaults: 5 min stale, gcTime ≥ persist maxAge', () => {
    const defaults = createQueryClient().getDefaultOptions().queries;
    expect(defaults?.staleTime).toBe(5 * 60_000);
    expect(defaults?.gcTime).toBeGreaterThanOrEqual(PERSIST_MAX_AGE);
    expect(persistOptions.maxAge).toBe(24 * 60 * 60_000);
  });

  it('persister round-trips through the KV adapter', async () => {
    const store = createMemoryStore();
    const persister = createQueryPersister(store);
    const client = { timestamp: 1, buster: 'b', clientState: { queries: [], mutations: [] } };
    await persister.persistClient(client);
    await new Promise((resolve) => setTimeout(resolve, 1100)); // throttleTime
    expect(await persister.restoreClient()).toEqual(client);
    await persister.removeClient();
    expect(store.getAllKeys()).toEqual([]);
  });
});

describe('installRateLimitToast', () => {
  it('shows the DESIGN §7 toast before a 429 retry', async () => {
    const restoreSleep = configureApiClient({ sleep: async () => undefined });
    const show = jest.fn();
    const uninstall = installRateLimitToast(show);
    let calls = 0;
    server.use(
      http.get(`${API}/v2/tagged`, () =>
        ++calls < 2 ? rateLimited(3) : HttpResponse.json(fixtures.tagged),
      ),
    );
    await apiFetch('/v2/tagged', { schema: z.unknown() });
    expect(show).toHaveBeenCalledWith('Tumblr is asking us to slow down — retrying in 3s');
    uninstall();
    restoreSleep();
  });
});
