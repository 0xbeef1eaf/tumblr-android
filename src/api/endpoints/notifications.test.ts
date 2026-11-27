import { http, HttpResponse } from 'msw';

import { API, server } from '@/test/msw';

import { setTokenProvider } from '../client';
import { ApiError } from '../errors';
import { NotificationsResponseSchema, notificationsCursor } from '../schemas/notifications';

import { getNotifications } from './notifications';

const ok = (response: unknown) => HttpResponse.json({ meta: { status: 200, msg: 'OK' }, response });
const PATH = '/v2/blog/pixelwanderer/notifications';

beforeEach(() =>
  setTokenProvider({
    getAccessToken: async () => 'token',
    refresh: async () => null,
    onAuthFailure: () => undefined,
  }),
);
afterEach(() => {
  setTokenProvider(null);
  server.events.removeAllListeners();
});

describe('getNotifications', () => {
  it('sends bearer auth and the cursor, parses the fixture and the next cursor', async () => {
    const seen: { auth: string | null; url: URL }[] = [];
    server.events.on('request:start', ({ request }) => {
      const url = new URL(request.url);
      if (url.pathname === PATH) seen.push({ auth: request.headers.get('Authorization'), url });
    });
    const page = await getNotifications({ blog: 'pixelwanderer', before: 1761990000 });
    expect(seen[0]?.auth).toBe('Bearer token');
    expect(Object.fromEntries(seen[0]?.url.searchParams ?? [])).toEqual({ before: '1761990000' });
    // The fixture's last item has no id and is dropped; unknown types are kept.
    expect(page.notifications.map((n) => n.id)).toEqual([
      'n-1001',
      'n-1002',
      'n-1003',
      'n-1004',
      'n-1005',
      'n-1006',
      'n-1007',
      'n-1008',
    ]);
    expect(page.notifications[7]?.type).toBe('some_future_type');
    expect(page.notifications[1]?.post_tags).toEqual(['fog', 'harbour']);
    expect(page.nextBefore).toBe(1761700000);
  });

  it('repeats types[] for a filter', async () => {
    const urls: URL[] = [];
    server.events.on('request:start', ({ request }) => {
      const url = new URL(request.url);
      if (url.pathname === PATH) urls.push(url);
    });
    await getNotifications({
      blog: 'pixelwanderer',
      types: ['reblog_naked', 'reblog_with_content'],
    });
    expect(urls[0]?.searchParams.getAll('types[]')).toEqual([
      'reblog_naked',
      'reblog_with_content',
    ]);
    expect(urls[0]?.searchParams.has('before')).toBe(false);
  });

  it('tolerates odd shapes: wrong field types degrade, missing list is empty', async () => {
    server.use(
      http.get(`${API}${PATH}`, () =>
        ok({
          notifications: [
            { id: 5, type: 'like', timestamp: '1761990000', unread: 'yes', post_tags: 'x' },
            { id: 'no-type', timestamp: 1 },
            'garbage',
          ],
          _links: 'nope',
        }),
      ),
    );
    const page = await getNotifications({ blog: 'pixelwanderer' });
    expect(page.notifications).toHaveLength(1);
    expect(page.notifications[0]).toMatchObject({
      id: '5',
      type: 'like',
      timestamp: 1761990000,
      unread: undefined,
      post_tags: [],
    });
    expect(page.nextBefore).toBeUndefined();
    expect(NotificationsResponseSchema.parse({})).toEqual({
      notifications: [],
      nextBefore: undefined,
    });
  });

  it('surfaces 403 as an ApiError', async () => {
    server.use(
      http.get(`${API}${PATH}`, () =>
        HttpResponse.json({ meta: { status: 403, msg: 'Forbidden' } }, { status: 403 }),
      ),
    );
    const error = await getNotifications({ blog: 'pixelwanderer' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(403);
  });
});

describe('notificationsCursor', () => {
  it.each([
    [undefined, undefined],
    [{}, undefined],
    [{ next: { href: '/x', query_params: { before: 1700 } } }, 1700],
    [{ next: { href: '/x', query_params: { before: '1700' } } }, 1700],
    [{ next: { href: '/v2/blog/a/notifications?rollups=true&before=1650' } }, 1650],
    [{ next: { href: '/v2/blog/a/notifications', query_params: { other: 'x' } } }, undefined],
  ])('%j → %s', (links, expected) => {
    expect(notificationsCursor(links)).toBe(expected);
  });
});
