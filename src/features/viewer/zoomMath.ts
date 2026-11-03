/**
 * Pure zoom/pan math shared by the gesture worklets and tests. Coordinates are relative to
 * the container centre; the transform is `translate(t) scale(s)` around that centre, so a
 * content point `q` lands on screen at `t + s·q`.
 */

export const MIN_SCALE = 1;
export const MAX_SCALE = 4;
/** Below this the image counts as un-zoomed (pager scroll and dismiss re-enabled). */
export const ZOOM_EPSILON = 0.01;
/** Swipe-down distance (dp) that dismisses the viewer on release. */
export const DISMISS_DISTANCE = 120;
export const DISMISS_VELOCITY = 1200;

export interface Size {
  width: number;
  height: number;
}

export function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

export function clampScale(scale: number): number {
  'worklet';
  return clamp(scale, MIN_SCALE, MAX_SCALE);
}

/** Size of a `contain`-fitted image of `aspect` (w/h) inside `container`. */
export function fitContain(aspect: number, container: Size): Size {
  'worklet';
  const safe = aspect > 0 && Number.isFinite(aspect) ? aspect : 1;
  if (container.width / container.height > safe) {
    return { width: container.height * safe, height: container.height };
  }
  return { width: container.width, height: container.width / safe };
}

/** Largest |translation| on each axis that keeps the scaled image covering the viewport. */
export function maxTranslation(content: Size, container: Size, scale: number): Size {
  'worklet';
  return {
    width: Math.max(0, (content.width * scale - container.width) / 2),
    height: Math.max(0, (content.height * scale - container.height) / 2),
  };
}

export function clampTranslation(
  x: number,
  y: number,
  content: Size,
  container: Size,
  scale: number,
): { x: number; y: number } {
  'worklet';
  const bound = maxTranslation(content, container, scale);
  return { x: clamp(x, -bound.width, bound.width), y: clamp(y, -bound.height, bound.height) };
}

/** Translation keeping `focal` (relative to centre) fixed while scaling `fromScale → toScale`. */
export function zoomAround(
  focal: number,
  translation: number,
  fromScale: number,
  toScale: number,
): number {
  'worklet';
  if (fromScale === 0) return translation;
  return focal - (focal - translation) * (toScale / fromScale);
}

/** Should a swipe-down release close the viewer? */
export function shouldDismiss(translationY: number, velocityY: number): boolean {
  'worklet';
  return translationY > DISMISS_DISTANCE || (translationY > 24 && velocityY > DISMISS_VELOCITY);
}

/** 0 → 1 as the finger drags down one container height. */
export function dismissProgress(translationY: number, containerHeight: number): number {
  'worklet';
  if (containerHeight <= 0) return 0;
  return clamp(translationY / containerHeight, 0, 1);
}
