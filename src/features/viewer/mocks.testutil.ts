/**
 * jest.mock factories for the viewer's native dependencies. Use inside factories:
 * `jest.mock('react-native-gesture-handler', () => require('./mocks.testutil').gestureHandlerMock())`.
 */
import type { ReactNode } from 'react';

export type GestureConfig = Record<string, unknown> & {
  onBegin?: (e: Record<string, number>) => void;
  onUpdate?: (e: Record<string, number>) => void;
  onActivate?: (e: Record<string, number>) => void;
  onDeactivate?: (e: Record<string, number>) => void;
  onFinalize?: (e: Record<string, number>) => void;
};

/** Latest config passed to each gesture hook, in call order per render. */
export const recordedGestures: { kind: string; config: GestureConfig }[] = [];

export function latestGesture(kind: string, match: (c: GestureConfig) => boolean = () => true) {
  for (let i = recordedGestures.length - 1; i >= 0; i -= 1) {
    const entry = recordedGestures[i];
    if (entry && entry.kind === kind && match(entry.config)) return entry.config;
  }
  throw new Error(`no ${kind} gesture recorded`);
}

export function gestureHandlerMock() {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const hook = (kind: string) => (config: GestureConfig) => {
    recordedGestures.push({ kind, config });
    return { kind, config };
  };
  const compose = (...gestures: unknown[]) => ({ gestures });
  return {
    GestureHandlerRootView: (props: Record<string, unknown>) => React.createElement(View, props),
    GestureDetector: ({ children }: { children?: ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    usePanGesture: hook('pan'),
    usePinchGesture: hook('pinch'),
    useTapGesture: hook('tap'),
    useSimultaneousGestures: compose,
    useExclusiveGestures: compose,
    useCompetingGestures: compose,
  };
}

export function workletsMock() {
  return {
    scheduleOnRN: (fn: (...args: unknown[]) => void, ...args: unknown[]) => fn(...args),
  };
}

/**
 * Minimal Reanimated stand-in. The shared `react-native-reanimated/mock` needs
 * `react-native-worklets/jest/resolver` in jest.config to load; this one has no native deps.
 */
export function reanimatedMock() {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const useSharedValue = <T>(initial: T) => {
    const [sv] = React.useState(() => {
      const box = {
        value: initial,
        get: () => box.value,
        set: (next: T) => {
          box.value = next;
        },
      };
      return box;
    });
    return sv;
  };
  const interpolate = (x: number, input: number[], output: number[]) => {
    const [i0 = 0, i1 = 1] = input;
    const [o0 = 0, o1 = 1] = output;
    const t = Math.min(1, Math.max(0, (x - i0) / (i1 - i0 || 1)));
    return o0 + (o1 - o0) * t;
  };
  const Animated = { View };
  return {
    __esModule: true,
    default: Animated,
    View,
    useSharedValue,
    useAnimatedStyle: (updater: () => Record<string, unknown>) => updater(),
    withTiming: <T>(value: T) => value,
    withSpring: <T>(value: T) => value,
    interpolate,
  };
}

/** Props of the last rendered PagerView. */
export const pagerProps: { current: Record<string, unknown> | null } = { current: null };

export function pagerViewMock() {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const PagerView = (props: Record<string, unknown> & { children?: ReactNode }) => {
    pagerProps.current = props;
    return React.createElement(
      View,
      { testID: props.testID as string | undefined },
      props.children,
    );
  };
  return { __esModule: true, default: PagerView };
}

export const videoPlayer = { play: jest.fn(), pause: jest.fn(), muted: false, loop: false };

export function expoVideoMock() {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    useVideoPlayer: (_source: unknown, setup?: (p: typeof videoPlayer) => void) => {
      const [player] = React.useState(() => {
        setup?.(videoPlayer);
        return videoPlayer;
      });
      return player;
    },
    VideoView: (props: Record<string, unknown>) => React.createElement(View, props),
  };
}

export function expoRouterMock() {
  return {
    router: {
      push: jest.fn(),
      back: jest.fn(),
      replace: jest.fn(),
      canGoBack: jest.fn(() => true),
    },
  };
}

export function mediaMocks() {
  return {
    clipboard: { setStringAsync: jest.fn(async () => true) },
    mediaLibrary: {
      requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
      Asset: { create: jest.fn(async () => ({})) },
    },
    fileSystem: { File: class {}, Paths: { cache: 'cache' } },
  };
}
