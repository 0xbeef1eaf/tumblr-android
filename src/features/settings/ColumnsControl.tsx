import { SegmentedControl } from './SegmentedControl';
import type { GridColumns } from './settingsStore';

const OPTIONS: readonly GridColumns[] = [2, 3];

export interface ColumnsControlProps {
  value: GridColumns;
  onChange: (columns: GridColumns) => void;
}

/** Two-option segmented control for the gallery column count. */
export function ColumnsControl({ value, onChange }: ColumnsControlProps) {
  return (
    <SegmentedControl
      options={OPTIONS}
      value={value}
      onChange={onChange}
      label="Grid columns"
      optionLabel={(option) => `${option} columns`}
      testIDPrefix="columns"
    />
  );
}
