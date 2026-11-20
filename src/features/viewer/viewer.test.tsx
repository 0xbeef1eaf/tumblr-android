import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Dimensions, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { makeGif, makeItem, makeItems } from '@/features/gallery/items.testutil';
import { useRevealStore } from '@/features/gallery/revealStore';
import { useViewerStore } from '@/features/gallery/viewerStore';
import { useSettingsStore } from '@/features/settings/settingsStore';

import { latestGesture, pagerProps, recordedGestures, videoPlayer } from './mocks.testutil';
import { VideoPage } from './VideoPage';
import { fitContain, maxTranslation } from './zoomMath';
import { ViewerScreen } from './ViewerScreen';

jest.mock('react-native-gesture-handler', () =>
  jest.requireActual('./mocks.testutil').gestureHandlerMock(),
);
jest.mock('react-native-reanimated', () => jest.requireActual('./mocks.testutil').reanimatedMock());
jest.mock('react-native-worklets', () => jest.requireActual('./mocks.testutil').workletsMock());
jest.mock('react-native-pager-view', () => jest.requireActual('./mocks.testutil').pagerViewMock());
jest.mock('expo-video', () => jest.requireActual('./mocks.testutil').expoVideoMock());
jest.mock('expo-router', () => jest.requireActual('./mocks.testutil').expoRouterMock());
jest.mock('expo-clipboard', () => jest.requireActual('./mocks.testutil').mediaMocks().clipboard);
jest.mock(
  'expo-media-library',
  () => jest.requireActual('./mocks.testutil').mediaMocks().mediaLibrary,
);
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
}));
jest.mock('expo-file-system', () => jest.requireActual('./mocks.testutil').mediaMocks().fileSystem);

const selectPage = (position: number) =>
  act(async () => {
    const onPageSelected = pagerProps.current?.onPageSelected as (e: unknown) => void;
    onPageSelected({ nativeEvent: { position } });
  });

beforeEach(() => {
  recordedGestures.length = 0;
  useViewerStore.getState().close();
  useRevealStore.getState().reset();
  useSettingsStore.getState().reset();
});

describe('ViewerScreen', () => {
  it('goes back immediately when the store is not open', async () => {
    await render(<ViewerScreen />);
    expect(screen.getByTestId('viewer-empty')).toBeTruthy();
    expect(router.back).toHaveBeenCalled();
  });

  it('renders the pager at the start index with chrome, and prefetches neighbours', async () => {
    const items = makeItems(5);
    useViewerStore.getState().open(items, 2);
    await render(<ViewerScreen />);
    expect(pagerProps.current?.initialPage).toBe(2);
    expect(screen.getByText('3 / 5')).toBeTruthy();
    // Only the current page ±1 is rendered.
    expect(screen.getByTestId('viewer-image-p2:0')).toBeTruthy();
    expect(screen.getByTestId('viewer-image-p1:0')).toBeTruthy();
    expect(screen.queryByTestId('viewer-image-p4:0')).toBeNull();
    // Full-size variant for the screen, grid variant as placeholder.
    const img = screen.getByTestId('viewer-image-p2:0-img');
    expect(img.props.source.uri).toContain('s1280x1920');
    expect(img.props.placeholder.uri).not.toContain('s1280x1920');
    expect(Image.prefetch).toHaveBeenCalledWith(
      [expect.stringContaining('p1/s1280'), expect.stringContaining('p3/s1280')],
      'memory-disk',
    );
    expect(router.back).not.toHaveBeenCalled();
  });

  it('updates the index on page change and asks for more near the end', async () => {
    const onLoadMore = jest.fn();
    useViewerStore.getState().open(makeItems(6), 0, { onLoadMore });
    await render(<ViewerScreen />);
    await selectPage(1);
    expect(useViewerStore.getState().index).toBe(1);
    expect(screen.getByText('2 / 6')).toBeTruthy();
    expect(onLoadMore).not.toHaveBeenCalled();
    await selectPage(3);
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('plays the active GIF page from an animated variant, never the poster', async () => {
    const gif = makeGif({ id: 'g:0', posterUrl: 'https://x/still.jpg' });
    useViewerStore.getState().open([makeItem({ id: 'i:0' }), gif], 0);
    await render(<ViewerScreen />);
    expect(screen.getByTestId('viewer-image-g:0-img').props.autoplay).toBe(false);

    await selectPage(1);
    const img = screen.getByTestId('viewer-image-g:0-img');
    expect(img.props.autoplay).toBe(true);
    expect(img.props.source.uri).toMatch(/\.gif$/);
    expect(img.props.placeholder?.uri ?? '').not.toContain('still');
  });

  it('dismisses on a long swipe down and springs back on a short one', async () => {
    useViewerStore.getState().open(makeItems(3), 0);
    await render(<ViewerScreen />);
    const dismiss = latestGesture('pan', (c) => c.activeOffsetY !== undefined);
    expect(dismiss.enabled).toBe(true);
    await act(async () => dismiss.onDeactivate?.({ translationY: 40, velocityY: 0 }));
    expect(router.back).not.toHaveBeenCalled();
    await act(async () => dismiss.onDeactivate?.({ translationY: 200, velocityY: 0 }));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('disables pager scroll and dismiss while zoomed', async () => {
    useViewerStore.getState().open(makeItems(3), 0);
    await render(<ViewerScreen />);
    expect(pagerProps.current?.scrollEnabled).toBe(true);
    const pinch = latestGesture('pinch');
    await act(async () => {
      pinch.onBegin?.({});
      pinch.onUpdate?.({ scale: 2, focalX: 100, focalY: 100 });
      pinch.onFinalize?.({});
    });
    expect(pagerProps.current?.scrollEnabled).toBe(false);
    expect(latestGesture('pan', (c) => c.activeOffsetY !== undefined).enabled).toBe(false);
  });

  it('likes the current item on double tap with a heart burst and a haptic tick', async () => {
    const items = makeItems(3);
    // Last page current: the most recently recorded gesture belongs to it.
    useViewerStore.getState().open(items, 2);
    const onDoubleTap = jest.fn();
    await render(<ViewerScreen onDoubleTap={onDoubleTap} />);
    expect(screen.queryByTestId('heart-burst')).toBeNull();
    const doubleTap = latestGesture('tap', (c) => c.numberOfTaps === 2 && c.enabled === true);
    await act(async () => doubleTap.onActivate?.({ x: 10, y: 10 }));
    expect(onDoubleTap).toHaveBeenCalledWith(items[2]);
    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
    const burst = screen.getByTestId('heart-burst');
    expect(burst.props.pointerEvents).toBe('none');
    // Double tap no longer zooms.
    expect(pagerProps.current?.scrollEnabled).toBe(true);
    await waitFor(() => expect(screen.queryByTestId('heart-burst')).toBeNull());
  });

  it('turns double tap off without an onDoubleTap handler', async () => {
    useViewerStore.getState().open(makeItems(1), 0);
    await render(<ViewerScreen />);
    expect(latestGesture('tap', (c) => c.numberOfTaps === 2).enabled).toBe(false);
  });

  it('toggles chrome on single tap and navigates from the bottom bar', async () => {
    useViewerStore.getState().open([makeItem({ id: '42:0', blogName: 'nasa' })], 0);
    await render(<ViewerScreen />);
    const singleTap = latestGesture('tap', (c) => c.numberOfTaps === undefined);
    await act(async () => singleTap.onActivate?.({}));
    expect(screen.getByTestId('viewer-chrome').props.pointerEvents).toBe('none');
    await act(async () => singleTap.onActivate?.({}));
    expect(screen.getByTestId('viewer-chrome').props.pointerEvents).toBe('box-none');

    await fireEvent.press(screen.getByTestId('viewer-blog'));
    expect(router.back).toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/blog/[name]',
      params: { name: 'nasa' },
    });
    await fireEvent.press(screen.getByTestId('viewer-caption'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/post/[blog]/[id]',
      params: { blog: 'nasa', id: '42' },
    });
  });

  it('renders an optional like slot', async () => {
    useViewerStore.getState().open(makeItems(1), 0);
    const renderLike = jest.fn(() => null);
    await render(<ViewerScreen renderLike={renderLike} />);
    expect(renderLike).toHaveBeenCalledWith(expect.objectContaining({ id: 'p0:0' }));
  });

  it('blurs unrevealed sensitive items under safe mode', async () => {
    useViewerStore.getState().open([makeItem({ id: '7:0', isSensitive: true })], 0);
    await render(<ViewerScreen />);
    expect(screen.getByTestId('viewer-image-7:0-img').props.blurRadius).toBe(30);
    // No (unblurred) placeholder may flash while hidden.
    expect(screen.getByTestId('viewer-image-7:0-img').props.placeholder).toBeUndefined();
    await fireEvent.press(screen.getByTestId('viewer-reveal'));
    expect(screen.getByTestId('viewer-image-7:0-img').props.blurRadius).toBeUndefined();
    expect(screen.getByTestId('viewer-image-7:0-img').props.placeholder?.uri).toBeDefined();
  });

  it('keeps media inside the safe-area box (cutout / status bar / nav bar)', async () => {
    const item = makeItem({ id: '9:0' });
    useViewerStore.getState().open([item], 0);
    const metrics = {
      frame: { x: 0, y: 0, width: 400, height: 800 },
      insets: { top: 48, bottom: 24, left: 0, right: 0 },
    };
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ViewerScreen />
      </SafeAreaProvider>,
    );
    const window = Dimensions.get('window');
    const box = StyleSheet.flatten(screen.getByTestId('viewer-box-9:0').props.style);
    expect(box).toMatchObject({ position: 'absolute', top: 48, left: 0, width: window.width });
    expect(box.height).toBe(window.height - 48 - 24);

    // Zoom/pan bounds come from the box, not the window.
    const pinch = latestGesture('pinch');
    await act(async () => {
      pinch.onBegin?.({});
      pinch.onUpdate?.({ scale: 2, focalX: 0, focalY: 0 });
      pinch.onFinalize?.({});
    });
    const boxSize = { width: box.width, height: box.height };
    const bound = maxTranslation(fitContain(item.aspectRatio, boxSize), boxSize, 2);
    const transform = StyleSheet.flatten(screen.getByTestId('viewer-image-9:0').props.style)
      .transform as Record<string, number>[];
    expect(transform[0]?.translateX).toBeCloseTo(bound.width);
    expect(transform[1]?.translateY).toBeCloseTo(bound.height);
  });

  it('closes the store when unmounted', async () => {
    useViewerStore.getState().open(makeItems(2), 0);
    const { unmount } = await render(<ViewerScreen />);
    await act(async () => unmount());
    expect(useViewerStore.getState().isOpen).toBe(false);
  });
});

describe('VideoPage', () => {
  const video = makeItem({ id: 'v:0', kind: 'video', videoUrl: 'https://v/x.mp4' });

  it('shows the poster and a play button unless autoplay is on, muted by default', async () => {
    await render(<VideoPage item={video} active targetWidthPx={1080} />);
    expect(videoPlayer.muted).toBe(true);
    expect(screen.getByTestId('video-poster')).toBeTruthy();
    expect(videoPlayer.play).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Play video' }));
    expect(videoPlayer.play).toHaveBeenCalled();
    expect(screen.queryByTestId('video-poster')).toBeNull();
    expect(screen.getByTestId('video-view').props.nativeControls).toBe(true);
  });

  it('autoplays when the setting is on and pauses when inactive', async () => {
    useSettingsStore.getState().setAutoplayVideo(true);
    const { rerender } = await render(<VideoPage item={video} active targetWidthPx={1080} />);
    expect(videoPlayer.play).toHaveBeenCalled();
    expect(screen.queryByTestId('video-poster')).toBeNull();
    await rerender(<VideoPage item={video} active={false} targetWidthPx={1080} />);
    expect(videoPlayer.pause).toHaveBeenCalled();
  });
});
