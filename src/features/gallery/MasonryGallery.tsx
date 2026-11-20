import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list';
import { router } from 'expo-router';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { RefreshControl, StyleSheet, useWindowDimensions, View } from 'react-native';

import type { GalleryItem } from '@/domain/galleryItem';
import { useSetting } from '@/features/settings/settingsStore';
import { layout, useTheme } from '@/ui/theme';

import { GallerySkeleton } from './GallerySkeleton';
import { GalleryTile } from './GalleryTile';
import {
  columnWidthPx as toColumnWidthPx,
  filterByKind,
  FOOTER_SKELETON_COUNT,
  SKELETON_TILE_COUNT,
  type KindFilter,
} from './layout';
import { QuickActionsSheet } from './QuickActionsSheet';
import { GIF_VIEWABILITY, useVisibleGifs } from './useVisibleGifs';
import { useViewerStore } from './viewerStore';

export interface MasonryGalleryProps {
  items: GalleryItem[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  onEndReached: () => void;
  onRefresh?: () => void;
  isRefetching?: boolean;
  /** Scrolls with the grid (e.g. a blog header). */
  header?: ReactElement | null;
  /** Shown when loading finished with no (filtered) items. */
  emptyState?: ReactNode;
  kindFilter?: KindFilter;
  /** Adds a Like row to the long-press sheet (WP4). */
  onLike?: (item: GalleryItem) => void;
  /** Like state for the sheet's Like row (optimistic/bookmark aware; see `useIsLiked`). */
  isLiked?: (item: GalleryItem) => boolean;
  testID?: string;
}

const half = layout.gutter / 2;
/** Render this many screens ahead (ARCHITECTURE §8). */
export const DRAW_DISTANCE_SCREENS = 3;
/** Ask for the next page two screens before the end (fast flings outrun one screen). */
export const END_REACHED_THRESHOLD = 2;

/** Masonry gallery over FlashList (DESIGN §4/§7, ARCHITECTURE §8). Tap opens `/viewer`. */
export function MasonryGallery({
  items,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  onEndReached,
  onRefresh,
  isRefetching = false,
  header = null,
  emptyState = null,
  kindFilter = 'all',
  onLike,
  isLiked,
  testID = 'masonry-gallery',
}: MasonryGalleryProps) {
  const { colors } = useTheme();
  const columns = useSetting('columns');
  const showBlogName = useSetting('showBlogName');
  const safeMode = useSetting('safeMode');
  const { width, height } = useWindowDimensions();
  const columnWidthPx = toColumnWidthPx(width, columns);
  const source = useId();
  const filtered = useMemo(() => filterByKind(items, kindFilter), [items, kindFilter]);
  const { animating, onViewableItemsChanged } = useVisibleGifs();
  const [sheetItem, setSheetItem] = useState<GalleryItem | null>(null);

  // Latest paging state for the viewer's load-more callback (read only in event handlers).
  const paging = useRef({ hasNextPage, isFetchingNextPage, onEndReached });
  useEffect(() => {
    paging.current = { hasNextPage, isFetchingNextPage, onEndReached };
  }, [hasNextPage, isFetchingNextPage, onEndReached]);

  const loadMore = useCallback(() => {
    const state = paging.current;
    if (state.hasNextPage && !state.isFetchingNextPage) state.onEndReached();
  }, []);

  // New pages (or a filter change) reach an open viewer that came from this gallery.
  useEffect(() => {
    useViewerStore.getState().syncItems(source, filtered);
  }, [filtered, source]);

  const openViewer = useCallback(
    (_item: GalleryItem, index: number) => {
      useViewerStore.getState().open(filtered, index, { source, onLoadMore: loadMore });
      router.push('/viewer');
    },
    [filtered, source, loadMore],
  );
  const openSheet = useCallback((item: GalleryItem) => setSheetItem(item), []);
  const closeSheet = useCallback(() => setSheetItem(null), []);

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<GalleryItem>) => (
      <View style={styles.cell}>
        <GalleryTile
          item={item}
          index={index}
          columnWidthPx={columnWidthPx}
          showBlogName={showBlogName}
          safeMode={safeMode}
          animateGifs={animating.has(item.id)}
          onPress={openViewer}
          onLongPress={openSheet}
        />
      </View>
    ),
    [animating, columnWidthPx, openSheet, openViewer, safeMode, showBlogName],
  );

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage && !isLoading) onEndReached();
  }, [hasNextPage, isFetchingNextPage, isLoading, onEndReached]);

  const refreshControl = onRefresh ? (
    <RefreshControl
      refreshing={isRefetching}
      onRefresh={onRefresh}
      tintColor={colors.accent}
      colors={[colors.accent]}
      progressBackgroundColor={colors.surfaceRaised}
    />
  ) : undefined;

  if (isLoading && filtered.length === 0) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]} testID={testID}>
        {header}
        <View style={styles.skeletonTop}>
          <GallerySkeleton columns={columns} count={SKELETON_TILE_COUNT} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]} testID={testID}>
      <FlashList
        data={filtered}
        masonry
        numColumns={columns}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        extraData={animating}
        drawDistance={height * DRAW_DISTANCE_SCREENS}
        contentContainerStyle={styles.content}
        onEndReached={handleEndReached}
        onEndReachedThreshold={END_REACHED_THRESHOLD}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={GIF_VIEWABILITY}
        refreshControl={refreshControl}
        ListHeaderComponent={header}
        ListEmptyComponent={isLoading ? null : <View testID="gallery-empty">{emptyState}</View>}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.footer}>
              <GallerySkeleton
                columns={columns}
                count={FOOTER_SKELETON_COUNT}
                seed={13}
                testID="gallery-footer-skeleton"
              />
            </View>
          ) : null
        }
        testID={`${testID}-list`}
      />
      <QuickActionsSheet item={sheetItem} onClose={closeSheet} onLike={onLike} isLiked={isLiked} />
    </View>
  );
}

function keyExtractor(item: GalleryItem): string {
  return item.id;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: layout.outerMargin - half },
  cell: { padding: half },
  skeletonTop: { paddingTop: layout.outerMargin - half },
  // The footer skeleton already carries the outer margin; cancel the list padding.
  footer: { marginHorizontal: -(layout.outerMargin - half) },
});
