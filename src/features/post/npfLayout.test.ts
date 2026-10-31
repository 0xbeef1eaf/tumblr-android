import type { NpfBlock, NpfLayout } from '@/api/schemas/npf';

import { buildRows, truncateAfter, truncateRows } from './npfLayout';

const blocks = (n: number): NpfBlock[] => Array.from({ length: n }, () => ({ type: 'text' }));
const rows = (display: number[][], extra: Partial<NpfLayout> = {}): NpfLayout[] => [
  { type: 'rows', display: display.map((b) => ({ blocks: b })), ...extra },
];

describe('buildRows', () => {
  it('makes one row per block without a layout', () => {
    expect(buildRows(blocks(3), [])).toEqual([{ blocks: [0] }, { blocks: [1] }, { blocks: [2] }]);
  });

  it('groups side-by-side blocks and keeps unmentioned blocks as own rows, in order', () => {
    expect(buildRows(blocks(6), rows([[0, 1], [2], [3]]))).toEqual([
      { blocks: [0, 1] },
      { blocks: [2] },
      { blocks: [3] },
      { blocks: [4] },
      { blocks: [5] },
    ]);
  });

  it('ignores invalid and duplicate indexes and non-rows layouts', () => {
    expect(buildRows(blocks(3), [...rows([[0, 0, 9, -1], [0]]), { type: 'ask' }])).toEqual([
      { blocks: [0] },
      { blocks: [1] },
      { blocks: [2] },
    ]);
  });

  it('orders rows by their first block', () => {
    expect(buildRows(blocks(3), rows([[2], [0, 1]]))).toEqual([
      { blocks: [0, 1] },
      { blocks: [2] },
    ]);
  });
});

describe('truncation', () => {
  it('reads truncate_after from the rows layout', () => {
    expect(truncateAfter(rows([[0]], { truncate_after: 2 }))).toBe(2);
    expect(truncateAfter(rows([[0]]))).toBeUndefined();
    expect(truncateAfter([])).toBeUndefined();
  });

  it('drops blocks after the cut-off, shrinking split rows', () => {
    const all = buildRows(blocks(5), rows([[0, 1], [2, 3], [4]]));
    expect(truncateRows(all, 2)).toEqual([{ blocks: [0, 1] }, { blocks: [2] }]);
  });
});
