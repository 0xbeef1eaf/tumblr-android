/**
 * Minimal Reanimated stand-in for Jest. The official `react-native-reanimated/mock` boots the
 * real module, which calls `setCSSEventHandler` on JSReanimated and throws under Jest (Reanimated
 * 4.7). This covers the hooks the app (viewer) uses; `reanimatedModule.ts` serves it wherever
 * `react-native-reanimated/mock` is required.
 */
export function reanimatedMock(): Record<string, unknown> {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const useSharedValue = <T>(initial: T) =>
    React.useState(() => {
      const box = {
        value: initial,
        get: () => box.value,
        set: (next: T) => {
          box.value = next;
        },
      };
      return box;
    })[0];
  const interpolate = (x: number, input: number[], output: number[]) => {
    const [i0 = 0, i1 = 1] = input;
    const [o0 = 0, o1 = 1] = output;
    const t = Math.min(1, Math.max(0, (x - i0) / (i1 - i0 || 1)));
    return o0 + (o1 - o0) * t;
  };
  const identity = <T>(value: T) => value;
  return {
    __esModule: true,
    default: { View },
    View,
    useSharedValue,
    useAnimatedStyle: (updater: () => Record<string, unknown>) => updater(),
    useReducedMotion: () => false,
    withTiming: identity,
    withSpring: identity,
    withSequence: <T>(...values: T[]) => values[values.length - 1],
    withDelay: <T>(_ms: number, value: T) => value,
    interpolate,
    Extrapolation: { CLAMP: 'clamp' },
    runOnJS: <F>(fn: F) => fn,
  };
}
