import type { NpfBlock, NpfLayout } from '@/api/schemas/npf';

export interface BlockRow {
  /** Indexes into the block list; more than one means "side by side". */
  blocks: number[];
}

/**
 * Turn NPF `layout` into display rows. Only `rows` layouts matter here; every block not
 * mentioned by a row becomes its own row, and rows are ordered by their first block.
 */
export function buildRows(content: readonly NpfBlock[], layout: readonly NpfLayout[]): BlockRow[] {
  const rows: BlockRow[] = [];
  const used = new Set<number>();
  for (const entry of layout) {
    if (entry.type !== 'rows') continue;
    for (const display of entry.display ?? []) {
      const blocks: number[] = [];
      for (const index of display.blocks) {
        const valid = Number.isInteger(index) && index >= 0 && index < content.length;
        if (!valid || used.has(index)) continue;
        used.add(index);
        blocks.push(index);
      }
      if (blocks.length > 0) rows.push({ blocks });
    }
  }
  content.forEach((_block, index) => {
    if (!used.has(index)) rows.push({ blocks: [index] });
  });
  return rows.sort((a, b) => Math.min(...a.blocks) - Math.min(...b.blocks));
}

/** `truncate_after` of the `rows` layout (index of the last block shown), if any. */
export function truncateAfter(layout: readonly NpfLayout[]): number | undefined {
  return layout.find((entry) => entry.type === 'rows' && typeof entry.truncate_after === 'number')
    ?.truncate_after;
}

/** Rows (and blocks within them) that survive truncation. */
export function truncateRows(rows: readonly BlockRow[], after: number): BlockRow[] {
  return rows.flatMap((row) => {
    const blocks = row.blocks.filter((index) => index <= after);
    return blocks.length > 0 ? [{ blocks }] : [];
  });
}
