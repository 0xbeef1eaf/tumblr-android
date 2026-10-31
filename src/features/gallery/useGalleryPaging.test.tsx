import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { createTestQueryClient } from '@/test/render';

import { makeItem } from './items.testutil';
import {
  flattenGalleryPages,
  MAX_ITEMLESS_PAGES,
  nextGalleryCursor,
  trailingItemlessPages,
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

function setup(pages: Record<string, FakePage> | ((cursor: number | undefined) => FakePage)) {
  const fetchPage = jest.fn(async (cursor: number | undefined) => {
    const page = typeof pages === 'function' ? pages(cursor) : pages[String(cursor ?? 'first')];
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

  it('keeps paging past a page that adds no new items (text-only posts)', () => {
    expect(nextGalleryCursor([page(['a:0']), page(['a:0'])], [undefined, 5], () => 4)).toBe(4);
    expect(nextGalleryCursor([page([])], [undefined], () => 4)).toBe(4);
  });

  it('stops when the caller has no cursor', () => {
    expect(nextGalleryCursor([page(['a:0'])], [undefined], () => undefined)).toBe(undefined);
  });

  it('continues with a fresh cursor and new items', () => {
    expect(nextGalleryCursor([page(['a:0']), page(['b:0'])], [undefined, 5], () => 4)).toBe(4);
  });
});

describe('trailingItemlessPages', () => {
  it('counts the trailing pages that brought nothing new', () => {
    expect(trailingItemlessPages([page(['a:0'])])).toBe(0);
    expect(trailingItemlessPages([page(['a:0']), page([]), page(['a:0'])])).toBe(2);
    expect(trailingItemlessPages([page([]), page(['a:0'])])).toBe(0);
  });
});

describe('useGalleryPaging', () => {
  it('pages, dedupes across pages and stops when the cursor repeats', async () => {
    const { fetchPage, render } = setup({
      first: { ids: ['a:0', 'b:0'], next: 10 },
      '10': { ids: ['b:0', 'c:0'], next: 20 },
      '20': { ids: ['d:0'], next: 20 },
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
    expect(result.current.items).toHaveLength(4);
    expect(fetchPage.mock.calls.map((c) => c[0])).toEqual([undefined, 10, 20]);

    // Further calls are no-ops.
    await act(async () => {
      await result.current.fetchNextPage();
    });
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it('loads past a text-only page automatically', async () => {
    const { fetchPage, render } = setup({
      first: { ids: ['a:0'], next: 10 },
      '10': { ids: [], next: 20 },
      '20': { ids: ['b:0'], next: 30 },
      '30': { ids: ['c:0'] },
    });
    const { result } = await render();
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.items.map((i) => i.id)).toEqual(['a:0', 'b:0']));
    expect(result.current.isFetchingNextPage).toBe(false);
    expect(result.current.hasNextPage).toBe(true);
    // Only the item-less page triggered an automatic fetch.
    expect(fetchPage.mock.calls.map((c) => c[0])).toEqual([undefined, 10, 20]);
  });

  it('loads a media page after a text-only first page', async () => {
    const { render } = setup({ first: { ids: [], next: 10 }, '10': { ids: ['a:0'] } });
    const { result } = await render();
    await waitFor(() => expect(result.current.items.map((i) => i.id)).toEqual(['a:0']));
    expect(result.current.hasNextPage).toBe(false);
  });

  it(`stops auto-advancing after ${MAX_ITEMLESS_PAGES} item-less pages in a row`, async () => {
    const { fetchPage, render } = setup((cursor) => ({ ids: [], next: (cursor ?? 0) + 1 }));
    const { result } = await render();
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(MAX_ITEMLESS_PAGES));
    await waitFor(() => expect(result.current.isFetchingNextPage).toBe(false));
    // Give a further (wrong) auto-advance the chance to run.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(fetchPage).toHaveBeenCalledTimes(MAX_ITEMLESS_PAGES);
    expect(result.current.hasNextPage).toBe(true);

    // A manual fetch (e.g. pull-to-load) still works.
    await act(async () => {
      await result.current.fetchNextPage();
    });
    expect(fetchPage).toHaveBeenCalledTimes(MAX_ITEMLESS_PAGES + 1);
  });

  it('does not auto-advance into a repeated cursor', async () => {
    const { fetchPage, render } = setup({
      first: { ids: ['a:0'], next: 10 },
      '10': { ids: ['a:0'], next: 10 },
    });
    const { result } = await render();
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
    expect(fetchPage.mock.calls.map((c) => c[0])).toEqual([undefined, 10]);
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
