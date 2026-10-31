import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { setTokenProvider } from '@/api/client';
import type { GalleryItem } from '@/domain/galleryItem';
import { createTestQueryClient } from '@/test/render';

import { useAuthStore } from './authStore';
import { useBookmarksStore } from './bookmarksStore';
import { useInteractionStore } from './interactionStore';

/** Test client whose finished mutations leave no 5-minute gc timer behind. */
export function createClient(): QueryClient {
  const client = createTestQueryClient();
  client.setDefaultOptions({
    ...client.getDefaultOptions(),
    mutations: { retry: false, gcTime: Infinity },
  });
  return client;
}

/** Test helpers shared by this feature's hook tests. */
export function createWrapper(client: QueryClient = createClient()) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

export function resetAuthState(): void {
  useAuthStore.getState().setGuest();
  useBookmarksStore.getState().clear();
  useInteractionStore.getState().reset();
}

/** Signed-in session plus a token provider that always yields a bearer token. */
export function signInForTest(name = 'pixelwanderer'): void {
  useAuthStore.getState().setSignedIn({ name, primaryBlog: name, primaryBlogUuid: 't:abc' });
  setTokenProvider({
    getAccessToken: async () => 'test-token',
    refresh: async () => null,
    onAuthFailure: () => undefined,
  });
}

export function makeTestItem(overrides: Partial<GalleryItem> = {}): GalleryItem {
  return {
    id: '742388497658807856:0',
    postId: '742388497658807856',
    blogName: 'northlight-studio',
    blogUuid: 't:Hk3xQp0R9vXbL2mNcY7a1w',
    reblogKey: 'qLMpjoPp',
    postUrl: 'https://northlight-studio.tumblr.com/post/742388497658807856',
    timestamp: 1_761_908_400,
    kind: 'image',
    variants: [{ url: 'https://64.media.tumblr.com/a/s640x960/a.jpg', width: 640, height: 960 }],
    aspectRatio: 2 / 3,
    tags: [],
    summary: '',
    isSensitive: false,
    indexInPost: 0,
    countInPost: 1,
    ...overrides,
  };
}
