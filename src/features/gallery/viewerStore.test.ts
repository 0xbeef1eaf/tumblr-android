import { makeItems } from './items.testutil';
import { useViewerStore } from './viewerStore';

describe('viewerStore', () => {
  beforeEach(() => useViewerStore.getState().close());

  it('opens, moves and closes', () => {
    const items = makeItems(5);
    const onLoadMore = jest.fn();
    useViewerStore.getState().open(items, 2, { source: 'g1', onLoadMore });
    expect(useViewerStore.getState()).toMatchObject({ isOpen: true, index: 2, source: 'g1' });
    expect(useViewerStore.getState().items).toBe(items);

    useViewerStore.getState().setIndex(4);
    expect(useViewerStore.getState().index).toBe(4);
    useViewerStore.getState().setIndex(99);
    expect(useViewerStore.getState().index).toBe(4);
    useViewerStore.getState().onLoadMore?.();
    expect(onLoadMore).toHaveBeenCalled();

    useViewerStore.getState().close();
    expect(useViewerStore.getState()).toMatchObject({ isOpen: false, items: [], index: 0 });
    expect(useViewerStore.getState().onLoadMore).toBeUndefined();
  });

  it('clamps the start index and ignores empty lists', () => {
    useViewerStore.getState().open([], 0);
    expect(useViewerStore.getState().isOpen).toBe(false);
    useViewerStore.getState().open(makeItems(3), -4);
    expect(useViewerStore.getState().index).toBe(0);
  });

  it('syncs items only for the opening source and keeps the current item selected', () => {
    const items = makeItems(4);
    useViewerStore.getState().open(items, 2, { source: 'g1' });
    const grown = [...makeItems(2, 'new'), ...items];

    useViewerStore.getState().syncItems('other', grown);
    expect(useViewerStore.getState().items).toBe(items);

    useViewerStore.getState().syncItems('g1', grown);
    expect(useViewerStore.getState().items).toBe(grown);
    expect(useViewerStore.getState().index).toBe(4);

    useViewerStore.getState().syncItems('g1', []);
    expect(useViewerStore.getState().isOpen).toBe(true);
  });
});
