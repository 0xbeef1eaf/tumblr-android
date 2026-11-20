import { act, renderHook } from '@testing-library/react-native';

import { makeItems } from './items.testutil';
import {
  MAX_STALLED_FETCHES,
  needsReadAhead,
  useViewerReadAhead,
  type ViewerReadAheadOptions,
} from './useViewerReadAhead';
import { useViewerStore } from './viewerStore';

const SOURCE = 'gallery-1';

function options(overrides: Partial<ViewerReadAheadOptions> = {}): ViewerReadAheadOptions {
  return {
    source: SOURCE,
    itemCount: 30,
    buffer: 10,
    hasNextPage: true,
    isFetchingNextPage: false,
    loadMore: jest.fn(),
    ...overrides,
  };
}

function openViewer(count: number, index: number, source = SOURCE) {
  useViewerStore.getState().open(makeItems(count), index, { source });
}

describe('needsReadAhead', () => {
  it.each([
    [30, 0, 10, false], // 29 ahead
    [30, 19, 10, false], // exactly 10 ahead
    [30, 20, 10, true], // 9 ahead
    [30, 29, 10, true], // last item
    [5, 0, 10, true], // short list
  ])('%d items at index %d with buffer %d → %s', (count, index, buffer, expected) => {
    expect(needsReadAhead(count, index, buffer)).toBe(expected);
  });
});

describe('useViewerReadAhead', () => {
  beforeEach(() => useViewerStore.getState().close());

  it('does nothing while the viewer is closed or open for another gallery', async () => {
    const o = options({ itemCount: 3 });
    await renderHook(() => useViewerReadAhead(o));
    expect(o.loadMore).not.toHaveBeenCalled();
    await act(async () => openViewer(3, 0, 'another-gallery'));
    expect(o.loadMore).not.toHaveBeenCalled();
  });

  it('fetches when fewer than `buffer` items remain after the current one', async () => {
    const o = options();
    await renderHook(() => useViewerReadAhead(o));
    await act(async () => openViewer(30, 5));
    expect(o.loadMore).not.toHaveBeenCalled(); // 24 ahead
    await act(async () => useViewerStore.getState().setIndex(20)); // 9 ahead
    expect(o.loadMore).toHaveBeenCalledTimes(1);
  });

  it('keeps fetching page after page until the buffer is full', async () => {
    const loadMore = jest.fn();
    const hook = await renderHook((p: ViewerReadAheadOptions) => useViewerReadAhead(p), {
      initialProps: options({ itemCount: 4, buffer: 20, loadMore }),
    });
    await act(async () => openViewer(4, 0));
    expect(loadMore).toHaveBeenCalledTimes(1);
    // The fetch runs, then lands a thin page: still short of the buffer, so fetch again.
    await hook.rerender(options({ itemCount: 4, buffer: 20, loadMore, isFetchingNextPage: true }));
    expect(loadMore).toHaveBeenCalledTimes(1);
    await hook.rerender(options({ itemCount: 9, buffer: 20, loadMore }));
    expect(loadMore).toHaveBeenCalledTimes(2);
    await hook.rerender(options({ itemCount: 9, buffer: 20, loadMore, isFetchingNextPage: true }));
    await hook.rerender(options({ itemCount: 40, buffer: 20, loadMore }));
    expect(loadMore).toHaveBeenCalledTimes(2); // 39 ahead: satisfied
  });

  it('waits for the running fetch and stops at the end of the feed', async () => {
    const loadMore = jest.fn();
    const hook = await renderHook((p: ViewerReadAheadOptions) => useViewerReadAhead(p), {
      initialProps: options({ itemCount: 3, loadMore, isFetchingNextPage: true }),
    });
    await act(async () => openViewer(3, 2));
    expect(loadMore).not.toHaveBeenCalled();
    await hook.rerender(options({ itemCount: 3, loadMore, hasNextPage: false }));
    expect(loadMore).not.toHaveBeenCalled();
  });

  it('gives up after repeated fetches that add nothing, and resumes when the list grows', async () => {
    const loadMore = jest.fn();
    const hook = await renderHook((p: ViewerReadAheadOptions) => useViewerReadAhead(p), {
      initialProps: options({ itemCount: 3, loadMore }),
    });
    await act(async () => openViewer(3, 0));
    for (let i = 0; i < MAX_STALLED_FETCHES + 3; i += 1) {
      await hook.rerender(options({ itemCount: 3, loadMore, isFetchingNextPage: true }));
      await hook.rerender(options({ itemCount: 3, loadMore }));
    }
    expect(loadMore).toHaveBeenCalledTimes(MAX_STALLED_FETCHES);
    await hook.rerender(options({ itemCount: 5, loadMore }));
    expect(loadMore).toHaveBeenCalledTimes(MAX_STALLED_FETCHES + 1);
  });

  it('uses a larger buffer when asked', async () => {
    const small = options({ itemCount: 60, buffer: 10 });
    const large = options({ itemCount: 60, buffer: 80 });
    await renderHook(() => useViewerReadAhead(small));
    await renderHook(() => useViewerReadAhead(large));
    await act(async () => openViewer(60, 0));
    expect(small.loadMore).not.toHaveBeenCalled();
    expect(large.loadMore).toHaveBeenCalledTimes(1);
  });
});
