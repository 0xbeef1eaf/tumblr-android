import { act, waitFor } from '@testing-library/react-native';

import { DEFAULT_MIN_ITEMS, MAX_AUTO_PAGES, MIN_NEW_ITEMS } from './useGalleryPaging';
import { ids, setupPaging } from './useGalleryPaging.testutil';

/** Lets a further (wrong) automatic fetch run before asserting it did not happen. */
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

describe('useGalleryPaging auto-advance', () => {
  it('keeps fetching through thin pages until minItems are loaded', async () => {
    // Every page adds 2 items: thin, so paging continues until the list is long enough
    // *and* the last page was not thin — here, until the cap.
    const { fetchPage, render } = setupPaging((cursor) => {
      const n = cursor ?? 0;
      return { ids: ids(2, `p${n}-`), next: n + 1 };
    });
    const { result } = await render();
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(MAX_AUTO_PAGES + 1));
    await settle();
    expect(fetchPage).toHaveBeenCalledTimes(MAX_AUTO_PAGES + 1);
    expect(result.current.items).toHaveLength(2 * (MAX_AUTO_PAGES + 1));
    expect(result.current.hasNextPage).toBe(true);

    // The cap only stops automatic fetches: onEndReached still loads more.
    await act(async () => {
      await result.current.fetchNextPage();
    });
    expect(fetchPage).toHaveBeenCalledTimes(MAX_AUTO_PAGES + 2);
  });

  it('stops once the list is long enough and the last page was rich', async () => {
    const rich = MIN_NEW_ITEMS;
    const { fetchPage, render } = setupPaging({
      first: { ids: ids(1, 'a'), next: 1 },
      '1': { ids: ids(rich, 'b'), next: 2 },
      '2': { ids: ids(rich, 'c'), next: 3 },
      '3': { ids: ids(rich, 'd'), next: 4 },
      '4': { ids: ids(rich, 'e'), next: 5 },
    });
    const { result } = await render();
    // 1 + 6 + 6 = 13 ≥ DEFAULT_MIN_ITEMS after page 2, which was rich.
    expect(1 + 2 * rich).toBeGreaterThanOrEqual(DEFAULT_MIN_ITEMS);
    await waitFor(() => expect(result.current.items).toHaveLength(1 + 2 * rich));
    await settle();
    expect(fetchPage.mock.calls.map((c) => c[0])).toEqual([undefined, 1, 2]);
  });

  it('resets the cap after a rich page', async () => {
    // Thin pages up to the cap, then a rich page, then thin pages again; the list stays
    // below minItems throughout.
    const richAt = MAX_AUTO_PAGES - 1;
    const { fetchPage, render } = setupPaging(
      (cursor) => {
        const n = cursor ?? 0;
        const count = n === richAt ? MIN_NEW_ITEMS : 1;
        return { ids: ids(count, `p${n}-`), next: n + 1 };
      },
      { minItems: 100 },
    );
    await render();
    // Pages 1…richAt are automatic (richAt fetches), the rich page resets the count, then
    // MAX_AUTO_PAGES more thin pages load before the cap stops it.
    const expected = 1 + richAt + MAX_AUTO_PAGES;
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(expected));
    await settle();
    expect(fetchPage).toHaveBeenCalledTimes(expected);
  });

  it('does not auto-advance after a failed page', async () => {
    const { fetchPage, render } = setupPaging({ first: { ids: ids(1, 'a'), next: 1 } });
    const { result } = await render();
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    await settle();
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });
});
