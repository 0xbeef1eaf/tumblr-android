import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { createTestQueryClient } from '@/test/render';

import { makeItem } from './items.testutil';
import {
  flattenGalleryPages,
  nextGalleryCursor,
  useGalleryPaging,
  type GalleryPage,
} from './useGalleryPaging';

interface FakePage {
  ids: string[];
  next?: number;
}

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>;
}

function setup(pages: Record<string, FakePage>) {
  const fetchPage = jest.fn(async (cursor: number | undefined) => {
    const page = pages[String(cursor ?? 'first')];
    if (!page) throw new Error(`no page ${cursor}`);
    return page;
  });
  return {
    fetchPage,
    render: () =>
      renderHook(
        () =>
          useGalleryPaging<FakePage>({
            queryKey: ['fake'],
            fetchPage,
            getItems: (page) => page.ids.map((id) => makeItem({ id })),
            getNextCursor: (page) => page.next,
          }),
        { wrapper },
      ),
  };
}

const page = (ids: string[]): GalleryPage<null> => ({
  page: null,
  items: ids.map((id) => makeItem({ id })),
});

describe('flattenGalleryPages', () => {
  it('flattens in order and keeps the first occurrence of each id', () => {
    const items = flattenGalleryPages([page(['a:0', 'b:0']), page(['b:0', 'c:0'])]);
    expect(items.map((i) => i.id)).toEqual(['a:0', 'b:0', 'c:0']);
  });
});

describe('nextGalleryCursor', () => {
  it('stops when the cursor repeats', () => {
    expect(nextGalleryCursor([page(['a:0']), page(['b:0'])], [undefined, 5], () => 5)).toBe(
      undefined,
    );
  });

  it('stops when the last page adds no new items', () => {
    expect(nextGalleryCursor([page(['a:0']), page(['a:0'])], [undefined, 5], () => 4)).toBe(
      undefined,
    );
    expect(nextGalleryCursor([page([])], [undefined], () => 4)).toBe(undefined);
  });

  it('continues with a fresh cursor and new items', () => {
    expect(nextGalleryCursor([page(['a:0']), page(['b:0'])], [undefined, 5], () => 4)).toBe(4);
  });
});

describe('useGalleryPaging', () => {
  it('pages, dedupes across pages and stops when a page brings nothing new', async () => {
    const { fetchPage, render } = setup({
      first: { ids: ['a:0', 'b:0'], next: 10 },
      '10': { ids: ['b:0', 'c:0'], next: 20 },
      '20': { ids: ['c:0'], next: 30 },
    });
    const { result } = await render();
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.hasNextPage).toBe(true);
    const firstItems = result.current.items;

    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() =>
      expect(result.current.items.map((i) => i.id)).toEqual(['a:0', 'b:0', 'c:0']),
    );
    expect(firstItems).not.toBe(result.current.items);

    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
    expect(result.current.items).toHaveLength(3);
    expect(fetchPage.mock.calls.map((c) => c[0])).toEqual([undefined, 10, 20]);

    // Further calls are no-ops.
    await act(async () => {
      await result.current.fetchNextPage();
    });
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it('keeps the items reference stable across unrelated re-renders', async () => {
    const { render } = setup({ first: { ids: ['a:0'] } });
    const { result, rerender } = await render();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const before = result.current.items;
    await rerender({});
    expect(result.current.items).toBe(before);
    expect(result.current.hasNextPage).toBe(false);
  });

  it('exposes errors', async () => {
    const { render } = setup({});
    const { result } = await render();
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.items).toEqual([]);
  });
});
