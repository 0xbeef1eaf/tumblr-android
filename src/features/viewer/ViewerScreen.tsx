import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { PixelRatio, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import PagerView, { type PagerViewOnPageSelectedEvent } from 'react-native-pager-view';
import Animated from 'react-native-reanimated';

import type { GalleryItem } from '@/domain/galleryItem';
import {
  columnWidthPx,
  openBlog,
  openPost,
  saveItem,
  shareItem,
  useViewerStore,
} from '@/features/gallery';
import { useSettingsStore } from '@/features/settings/settingsStore';
import { useReducedMotion } from '@/ui/useReducedMotion';

import { useDismissGesture } from './useDismissGesture';
import { ViewerChrome } from './ViewerChrome';
import { ViewerPage, viewerVariant } from './ViewerPage';

/** Pages within this distance of the current one are rendered (and ±1 prefetched). */
const RENDER_WINDOW = 1;
/** Ask the gallery for the next page when this close to the end. */
export const LOAD_MORE_THRESHOLD = 3;

export interface ViewerScreenProps {
  /** Optional Like control for the bottom bar (WP4). */
  renderLike?: (item: GalleryItem) => ReactNode;
}

function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** Neighbours' viewer variants go into the image cache before they are swiped to. */
export function prefetchNeighbours(items: GalleryItem[], index: number, screenWidthPx: number) {
  const urls = [items[index - 1], items[index + 1]].flatMap((item) => {
    const url = item ? viewerVariant(item, screenWidthPx)?.url : undefined;
    return url ? [url] : [];
  });
  if (urls.length > 0) Image.prefetch(urls, 'memory-disk').catch(() => undefined);
}

/** `/viewer` (DESIGN §3.7): reads the in-memory viewer store filled by a gallery. */
export function ViewerScreen({ renderLike }: ViewerScreenProps) {
  const isOpen = useViewerStore((s) => s.isOpen && s.items.length > 0);

  // Opened without a gallery (deep link, process restore): nothing to show, go back.
  useEffect(() => {
    if (!useViewerStore.getState().isOpen) leave();
    return () => useViewerStore.getState().close();
  }, []);

  if (!isOpen) return <View style={styles.root} testID="viewer-empty" />;
  return <ViewerContent renderLike={renderLike} />;
}

function ViewerContent({ renderLike }: ViewerScreenProps) {
  const items = useViewerStore((s) => s.items);
  const index = useViewerStore((s) => s.index);
  const setIndex = useViewerStore((s) => s.setIndex);
  const safeMode = useSettingsStore((s) => s.safeMode);
  const columns = useSettingsStore((s) => s.columns);
  const { width, height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const [initialPage] = useState(index);
  const [zoomed, setZoomed] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const pager = useRef<PagerView>(null);
  const pagerPosition = useRef(initialPage);

  const screenWidthPx = Math.round(width * PixelRatio.get());
  const gridWidthPx = columnWidthPx(width, columns);
  const size = { width, height };

  useEffect(() => {
    prefetchNeighbours(items, index, screenWidthPx);
  }, [items, index, screenWidthPx]);

  // `syncItems` may move the current item (e.g. a refresh prepended posts): follow it.
  useEffect(() => {
    if (pagerPosition.current === index) return;
    pagerPosition.current = index;
    pager.current?.setPageWithoutAnimation(index);
  }, [index]);

  const dismiss = useCallback(() => {
    leave();
  }, []);

  const { gesture, contentStyle, backdropStyle } = useDismissGesture({
    enabled: !zoomed,
    containerHeight: height,
    reducedMotion,
    onDismiss: dismiss,
  });

  const onPageSelected = useCallback(
    (event: PagerViewOnPageSelectedEvent) => {
      const position = event.nativeEvent.position;
      pagerPosition.current = position;
      setIndex(position);
      setZoomed(false);
      const state = useViewerStore.getState();
      if (position >= state.items.length - LOAD_MORE_THRESHOLD) state.onLoadMore?.();
    },
    [setIndex],
  );

  const toggleChrome = useCallback(() => setChromeVisible((v) => !v), []);

  /** Chrome navigation leaves the modal first so the target pushes onto the main stack. */
  const goToBlog = useCallback((item: GalleryItem) => {
    leave();
    openBlog(item.blogName);
  }, []);
  const goToPost = useCallback((item: GalleryItem) => {
    leave();
    openPost(item);
  }, []);
  const share = useCallback((item: GalleryItem) => void shareItem(item), []);
  const save = useCallback((item: GalleryItem) => void saveItem(item), []);

  const current = items[index];
  if (!current) return <View style={styles.root} testID="viewer-empty" />;

  return (
    <View style={styles.root} testID="viewer">
      <StatusBar style="light" hidden={!chromeVisible} />
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.root, contentStyle]}>
          <PagerView
            ref={pager}
            style={styles.root}
            initialPage={initialPage}
            scrollEnabled={!zoomed}
            offscreenPageLimit={RENDER_WINDOW}
            onPageSelected={onPageSelected}
            testID="viewer-pager"
          >
            {items.map((item, i) => (
              <View key={item.id} style={styles.root} collapsable={false}>
                {Math.abs(i - index) <= RENDER_WINDOW ? (
                  <ViewerPage
                    item={item}
                    active={i === index}
                    size={size}
                    screenWidthPx={screenWidthPx}
                    gridWidthPx={gridWidthPx}
                    safeMode={safeMode}
                    onZoomChange={setZoomed}
                    onToggleChrome={toggleChrome}
                  />
                ) : null}
              </View>
            ))}
          </PagerView>
        </Animated.View>
      </GestureDetector>
      <ViewerChrome
        item={current}
        index={index}
        count={items.length}
        visible={chromeVisible && !zoomed}
        reducedMotion={reducedMotion}
        onClose={dismiss}
        onOpenBlog={goToBlog}
        onOpenPost={goToPost}
        onShare={share}
        onSave={save}
        likeSlot={renderLike?.(current)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { backgroundColor: '#000000' },
});
