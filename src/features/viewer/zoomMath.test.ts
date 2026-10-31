import {
  clampScale,
  clampTranslation,
  DISMISS_DISTANCE,
  dismissProgress,
  fitContain,
  maxTranslation,
  shouldDismiss,
  zoomAround,
} from './zoomMath';

const screen = { width: 400, height: 800 };

describe('zoomMath', () => {
  it('clamps scale to 1–4x', () => {
    expect(clampScale(0.3)).toBe(1);
    expect(clampScale(2)).toBe(2);
    expect(clampScale(9)).toBe(4);
  });

  it('fits images with contain', () => {
    expect(fitContain(2, screen)).toEqual({ width: 400, height: 200 });
    expect(fitContain(0.25, screen)).toEqual({ width: 200, height: 800 });
    expect(fitContain(Number.NaN, screen)).toEqual({ width: 400, height: 400 });
  });

  it('bounds panning so the image never leaves the viewport', () => {
    const content = fitContain(2, screen); // 400×200
    expect(maxTranslation(content, screen, 1)).toEqual({ width: 0, height: 0 });
    expect(maxTranslation(content, screen, 2)).toEqual({ width: 200, height: 0 });
    expect(clampTranslation(500, 50, content, screen, 2)).toEqual({ x: 200, y: 0 });
    expect(clampTranslation(-900, 0, content, screen, 4)).toEqual({ x: -600, y: 0 });
  });

  it('keeps the focal point fixed while zooming', () => {
    const focal = 100;
    const t = zoomAround(focal, 0, 1, 2.5);
    // content point under the focal before: (100 - 0) / 1 = 100; after: t + 2.5 * 100 = focal.
    expect(t + 2.5 * 100).toBeCloseTo(focal);
    expect(zoomAround(focal, 30, 2, 2)).toBe(30);
  });

  it('dismisses past 120dp or on a downward fling', () => {
    expect(shouldDismiss(DISMISS_DISTANCE + 1, 0)).toBe(true);
    expect(shouldDismiss(60, 0)).toBe(false);
    expect(shouldDismiss(60, 2000)).toBe(true);
    expect(shouldDismiss(-200, 0)).toBe(false);
    expect(dismissProgress(400, 800)).toBe(0.5);
    expect(dismissProgress(-10, 800)).toBe(0);
  });
});
