import { act, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { HEART_FLASH_MS, HeartBurst } from './HeartBurst';
import { latestGesture, recordedGestures } from './mocks.testutil';
import { ZoomableImage } from './ZoomableImage';

jest.mock('react-native-gesture-handler', () =>
  jest.requireActual('./mocks.testutil').gestureHandlerMock(),
);
jest.mock('react-native-reanimated', () => jest.requireActual('./mocks.testutil').reanimatedMock());
jest.mock('react-native-worklets', () => jest.requireActual('./mocks.testutil').workletsMock());

beforeEach(() => {
  recordedGestures.length = 0;
});

describe('ZoomableImage', () => {
  const size = { width: 400, height: 800 };

  it('renders and reports zoom changes from pinch', async () => {
    const onZoomChange = jest.fn();
    await render(
      <ZoomableImage
        uri="https://x/full.jpg"
        placeholderUri="https://x/grid.jpg"
        aspectRatio={0.5}
        size={size}
        active
        accessibilityLabel="Image from staff"
        onZoomChange={onZoomChange}
      />,
    );
    expect(screen.getByLabelText('Image from staff')).toBeTruthy();
    const pinch = latestGesture('pinch');
    await act(async () => {
      pinch.onBegin?.({});
      pinch.onUpdate?.({ scale: 2, focalX: 200, focalY: 400 });
      pinch.onFinalize?.({});
    });
    expect(onZoomChange).toHaveBeenLastCalledWith(true);
    expect(latestGesture('pan').enabled).toBe(true);

    await act(async () => {
      pinch.onBegin?.({});
      pinch.onUpdate?.({ scale: 0.5, focalX: 200, focalY: 400 });
      pinch.onFinalize?.({});
    });
    expect(onZoomChange).toHaveBeenLastCalledWith(false);
  });

  it('calls onDoubleTap instead of zooming on double tap', async () => {
    const onDoubleTap = jest.fn();
    const onZoomChange = jest.fn();
    await render(
      <ZoomableImage
        uri="https://x/full.jpg"
        aspectRatio={1}
        size={size}
        active
        accessibilityLabel="Image"
        onZoomChange={onZoomChange}
        onDoubleTap={onDoubleTap}
      />,
    );
    const doubleTap = latestGesture('tap', (c) => c.numberOfTaps === 2);
    expect(doubleTap.enabled).toBe(true);
    await act(async () => doubleTap.onActivate?.({ x: 0, y: 0 }));
    expect(onDoubleTap).toHaveBeenCalledTimes(1);
    expect(onZoomChange).not.toHaveBeenCalled();
  });
});

describe('ZoomableImage GIF playback', () => {
  const size = { width: 400, height: 800 };
  const page = (active: boolean, autoplay: boolean) => (
    <ZoomableImage
      uri="https://x/full.gif"
      aspectRatio={1}
      size={size}
      active={active}
      autoplay={autoplay}
      accessibilityLabel="GIF"
    />
  );

  it('plays only on the active page and remounts so swiping back restarts it', async () => {
    const { rerender } = await render(page(false, true));
    const idle = screen.getByTestId('zoomable-image-img');
    expect(idle.props.autoplay).toBe(false);

    await rerender(page(true, true));
    const playing = screen.getByTestId('zoomable-image-img');
    expect(playing.props.autoplay).toBe(true);
    expect(playing).not.toBe(idle);

    await rerender(page(false, true));
    await rerender(page(true, true));
    expect(screen.getByTestId('zoomable-image-img')).not.toBe(playing);
  });

  it('keeps a still image mounted across activation', async () => {
    const { rerender } = await render(page(false, false));
    const before = screen.getByTestId('zoomable-image-img');
    await rerender(page(true, false));
    expect(screen.getByTestId('zoomable-image-img')).toBe(before);
  });
});

describe('HeartBurst', () => {
  afterEach(() => jest.useRealTimers());

  it('pops in and ends after the burst', async () => {
    jest.useFakeTimers();
    const onDone = jest.fn();
    await render(<HeartBurst reducedMotion={false} onDone={onDone} />);
    expect(screen.getByTestId('heart-burst').props.pointerEvents).toBe('none');
    await act(async () => {
      jest.advanceTimersByTime(599);
    });
    expect(onDone).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('with reduced motion just flashes, unscaled, for 400 ms', async () => {
    jest.useFakeTimers();
    const onDone = jest.fn();
    await render(<HeartBurst reducedMotion onDone={onDone} />);
    const heart = screen.getByTestId('heart-burst').children[0];
    const style: unknown = typeof heart === 'object' ? heart.props.style : undefined;
    expect(StyleSheet.flatten(style as never)).toMatchObject({
      opacity: 1,
      transform: [{ scale: 1 }],
    });
    await act(async () => {
      jest.advanceTimersByTime(HEART_FLASH_MS);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
