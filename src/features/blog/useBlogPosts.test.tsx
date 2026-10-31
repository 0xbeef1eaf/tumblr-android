import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';

import { BlogPostsResponseSchema, type BlogPostsResponse } from '@/api/schemas/blog';
import { fx } from '@/domain/fixtures.testutil';
import { API, server } from '@/test/msw';
import { createTestQueryClient } from '@/test/render';

import { blogNextCursor, blogPageCursor, useBlogPosts } from './useBlogPosts';

jest.mock(
  '@/features/gallery',
  () => jest.requireActual('@/features/tag/galleryMock.testutil').galleryMock,
);

const raw = fx.raw.blogPosts.response;

function page(overrides: Record<string, unknown> = {}): BlogPostsResponse {
  return BlogPostsResponseSchema.parse({ ...raw, ...overrides });
}

const LAST_TIMESTAMP = raw.posts[raw.posts.length - 1]?.timestamp;

describe('blogPageCursor', () => {
  it('prefers _links.next.query_params.before', () => {
    expect(blogPageCursor(page())).toBe(1761894000);
  });

  it('accepts a numeric before', () => {
    const links = { next: { href: '/x', query_params: { before: 55 } } };
    expect(blogPageCursor(page({ _links: links }))).toBe(55);
  });

  it('falls back to the last post timestamp without _links', () => {
    expect(blogPageCursor(page({ _links: undefined }))).toBe(LAST_TIMESTAMP);
  });

  it('falls back when _links has no usable before', () => {
    const links = { next: { href: '/x', query_params: { npf: 'true' } } };
    expect(blogPageCursor(page({ _links: links }))).toBe(LAST_TIMESTAMP);
  });

  it('is undefined for an empty page without links', () => {
    expect(blogPageCursor(page({ posts: [], _links: undefined }))).toBeUndefined();
  });
});

describe('blogNextCursor', () => {
  it('stops on an empty page and when the cursor repeats', () => {
    const a = page();
    expect(blogNextCursor(page({ posts: [] }), [a])).toBeUndefined();
    expect(blogNextCursor(a, [a])).toBe(1761894000);
    expect(blogNextCursor(a, [a, a])).toBeUndefined();
  });
});

describe('useBlogPosts', () => {
  function setup() {
    const client = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return { client, wrapper };
  }

  it('requests NPF posts, follows _links before, and sends the tag filter', async () => {
    const requests: URL[] = [];
    server.use(
      http.get(`${API}/v2/blog/:blog/posts`, ({ request }) => {
        const url = new URL(request.url);
        requests.push(url);
        const body = url.searchParams.has('before')
          ? { ...raw, posts: raw.posts.slice(0, 1).map((p) => ({ ...p, id_string: 'older' })) }
          : raw;
        return HttpResponse.json({ meta: { status: 200, msg: 'OK' }, response: body });
      }),
    );
    const { client, wrapper } = setup();
    const { result } = await renderHook(() => useBlogPosts('northlight-studio', 'iceland'), {
      wrapper,
    });
    await waitFor(() => expect(result.current.items.length).toBeGreaterThan(0));
    expect(requests[0]?.searchParams.get('npf')).toBe('true');
    expect(requests[0]?.searchParams.get('tag')).toBe('iceland');
    expect(
      client.getQueryState(['blog', 'northlight-studio', 'posts', { tag: 'iceland' }]),
    ).toBeDefined();

    await act(async () => {
      await result.current.fetchNextPage();
    });
    expect(requests[1]?.searchParams.get('before')).toBe('1761894000');
  });

  it('exposes a not-found error', async () => {
    const { wrapper } = setup();
    const { result } = await renderHook(() => useBlogPosts('this-blog-does-not-exist'), {
      wrapper,
    });
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.name).toBe('NotFoundError');
  });
});
