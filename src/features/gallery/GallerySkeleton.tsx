import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Skeleton } from '@/ui/primitives';
import { layout } from '@/ui/theme';

import { distributeColumns, skeletonAspects } from './layout';

export interface GallerySkeletonProps {
  columns: number;
  count: number;
  /** Different seeds keep the footer from mirroring the first-load grid. */
  seed?: number;
  testID?: string;
}

/** Masonry-shaped placeholder grid (DESIGN §7): stable pseudo-random aspect ratios. */
function GallerySkeletonImpl({
  columns,
  count,
  seed = 7,
  testID = 'gallery-skeleton',
}: GallerySkeletonProps) {
  const cols = useMemo(() => {
    const entries = skeletonAspects(count, seed).map((aspect, i) => ({ aspect, key: `s${i}` }));
    return distributeColumns(entries, columns, (e) => 1 / e.aspect);
  }, [columns, count, seed]);

  return (
    <View
      style={styles.row}
      testID={testID}
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
    >
      {cols.map((col, c) => (
        <View key={`c${c}`} style={styles.column}>
          {col.map((entry) => (
            <View key={entry.key} style={styles.cell}>
              <Skeleton aspectRatio={entry.aspect} testID="skeleton-tile" />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

export const GallerySkeleton = memo(GallerySkeletonImpl);

const half = layout.gutter / 2;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: layout.outerMargin - half },
  column: { flex: 1 },
  cell: { padding: half },
});
