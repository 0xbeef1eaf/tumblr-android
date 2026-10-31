import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';

import { PostListSchema, type Post } from '@/api/schemas/post';
import { fx } from '@/domain/fixtures.testutil';
import { API, server } from '@/test/msw';
import { createTestQueryClient } from '@/test/render';

import { taggedNextCursor, taggedPageCursor, useTaggedPosts } from './useTaggedPosts';

jest.mock('@/features/gallery', () => jest.requireActual('./galleryMock.testutil').galleryMock);

const post = (timestamp: number, featured?: number | null): Post => {
  const [parsed] = PostListSchema.parse([
    {
      ...fx.raw.tagged.response[0],
      id_string: String(timestamp),
      timestamp,
      featured_timestamp: featured,
    },
  ]);
  if (!parsed) throw new Error('post did not parse');
  return parsed;
};

describe('taggedPageCursor', () => {
  it.each<[string, Post[], number | undefined]>([
    ['empty page', [], undefined],
    ['smallest timestamp', [post(300), post(200)], 200],
    ['all featured: smallest featured_timestamp', [post(300, 400), post(200, 350)], 350],
    ['mixed page: smallest timestamp, not a later featured one', [post(300), post(200, 250)], 200],
    ['null featured_timestamp counts as missing', [post(300, 400), post(200, null)], 200],
    ['out-of-order timestamps use the minimum', [post(200), post(300)], 200],
  ])('%s', (_name, page, expected) => {
    expect(taggedPageCursor(page)).toBe(expected);
  });

  it('uses the smallest timestamp on the photography fixture (mixed featured)', () => {
    const page = PostListSchema.parse(fx.raw.tagged.response);
    expect(taggedPageCursor(page)).toBe(1761903000);
  });
});

describe('taggedNextCursor', () => {
  it('stops when the cursor did not move between pages', () => {
    const a = [post(300), post(200)];
    const b = [post(250), post(200)];
    expect(taggedNextCursor(b, [a, b])).toBeUndefined();
    expect(taggedNextCursor(a, [a])).toBe(200);
    expect(taggedNextCursor([], [a, []])).toBeUndefined();
  });
});

describe('useTaggedPosts', () => {
  it('pages with before = the smallest timestamp on a mixed page and normalises items', async () => {
    const requests: URL[] = [];
    // Page 1 ends in a featured post whose featured_timestamp (1761911400) is later than its
    // timestamp (1761903000); using it would re-request posts already on page 1.
    const page1 = fx.raw.tagged.response;
    const page2 = [fx.raw.tagged.response[0]].map((p) => ({
      ...p,
      id_string: 'older',
      timestamp: 100,
    }));
    server.use(
      http.get(`${API}/v2/tagged`, ({ request }) => {
        const url = new URL(request.url);
        requests.push(url);
        const body = url.searchParams.has('before') ? page2 : page1;
        return HttpResponse.json({ meta: { status: 200, msg: 'OK' }, response: body });
      }),
    );
    const client = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = await renderHook(() => useTaggedPosts('photography'), { wrapper });

    await waitFor(() => expect(result.current.items.length).toBeGreaterThan(0));
    expect(requests[0]?.searchParams.get('tag')).toBe('photography');
    expect(requests[0]?.searchParams.get('limit')).toBe('20');
    expect(requests[0]?.searchParams.has('before')).toBe(false);
    expect(result.current.items.every((i) => i.kind !== undefined)).toBe(true);
    expect(result.current.hasNextPage).toBe(true);

    const before = result.current.items.length;
    await act(async () => {
      await result.current.fetchNextPage();
    });
    expect(requests[1]?.searchParams.get('before')).toBe('1761903000');
    await waitFor(() => expect(result.current.items.length).toBeGreaterThan(before));
    expect(client.getQueryState(['tagged', 'photography'])).toBeDefined();
  });

  it('does not fetch for an empty tag', async () => {
    const client = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = await renderHook(() => useTaggedPosts(''), { wrapper });
    expect(result.current.items).toEqual([]);
    expect(client.getQueryCache().getAll()).toHaveLength(1);
    expect(result.current.isLoading).toBe(false);
  });
});
