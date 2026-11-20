import { act, waitFor } from '@testing-library/react-native';

import { makeItem } from './items.testutil';
import {
  flattenGalleryPages,
  lastPageNewItems,
  MAX_AUTO_PAGES,
  nextGalleryCursor,
  type GalleryPage,
} from './useGalleryPaging';
import { setupPaging, type FakePage, type PageSource } from './useGalleryPaging.testutil';

/** Only item-less pages auto-advance here, so these tests drive paging by hand. */
const setup = (pages: PageSource) => setupPaging(pages, { minItems: 0, minNewItems: 1 });

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

describe('lastPageNewItems', () => {
  it('counts the items the last page added that earlier pages did not have', () => {
    expect(lastPageNewItems([])).toBe(0);
    expect(lastPageNewItems([page(['a:0', 'b:0'])])).toBe(2);
    expect(lastPageNewItems([page(['a:0']), page(['a:0', 'b:0', 'b:0'])])).toBe(1);
    expect(lastPageNewItems([page(['a:0']), page([])])).toBe(0);
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

  it(`stops auto-advancing after ${MAX_AUTO_PAGES} automatic item-less fetches in a row`, async () => {
    const { fetchPage, render } = setup((cursor) => ({ ids: [], next: (cursor ?? 0) + 1 }));
    const { result } = await render();
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(MAX_AUTO_PAGES + 1));
    await waitFor(() => expect(result.current.isFetchingNextPage).toBe(false));
    // Give a further (wrong) auto-advance the chance to run.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(fetchPage).toHaveBeenCalledTimes(MAX_AUTO_PAGES + 1);
    expect(result.current.hasNextPage).toBe(true);

    // A manual fetch (e.g. pull-to-load) still works.
    await act(async () => {
      await result.current.fetchNextPage();
    });
    expect(fetchPage).toHaveBeenCalledTimes(MAX_AUTO_PAGES + 2);
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

  it('refresh() starts over from a fresh first page', async () => {
    let firstPageCalls = 0;
    let release: () => void = () => undefined;
    const fresh = new Promise<FakePage>((resolve) => {
      release = () => resolve({ ids: ['x:0', 'y:0'], next: 10 });
    });
    const { fetchPage, render } = setup((cursor) => {
      if (cursor !== undefined) return { ids: ['c:0'], next: 20 };
      firstPageCalls += 1;
      return firstPageCalls === 1 ? { ids: ['a:0', 'b:0'], next: 10 } : fresh;
    });
    const { result } = await render();
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.items).toHaveLength(3));
    fetchPage.mockClear();

    await act(async () => {
      void result.current.refresh();
    });
    // The old first page stays visible (with the refresh spinner) while page 1 reloads.
    await waitFor(() => expect(result.current.items.map((i) => i.id)).toEqual(['a:0', 'b:0']));
    expect(result.current.isRefetching).toBe(true);
    await act(async () => release());
    await waitFor(() => expect(result.current.items.map((i) => i.id)).toEqual(['x:0', 'y:0']));
    expect(fetchPage.mock.calls.map((c) => c[0])).toEqual([undefined]);
    expect(result.current.hasNextPage).toBe(true);
    expect(result.current.isRefetching).toBe(false);
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
