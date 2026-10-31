import { server } from './msw';

/* ---------- native module mocks ---------- */

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    isAvailableAsync: jest.fn(async () => true),
  };
});

jest.mock('react-native-mmkv', () => {
  const createMMKV = () => {
    const map = new Map<string, string | number | boolean>();
    return {
      set: (key: string, value: string | number | boolean) => map.set(key, value),
      getString: (key: string) => {
        const value = map.get(key);
        return typeof value === 'string' ? value : undefined;
      },
      remove: (key: string) => map.delete(key),
      getAllKeys: () => [...map.keys()],
      clearAll: () => map.clear(),
      contains: (key: string) => map.has(key),
    };
  };
  return { createMMKV };
});

jest.mock('expo-image', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const Image = Object.assign(
    (props: Record<string, unknown>) => {
      const React = jest.requireActual<typeof import('react')>('react');
      return React.createElement(View, {
        ...props,
        testID: (props.testID as string | undefined) ?? 'expo-image',
      });
    },
    {
      prefetch: jest.fn(async () => true),
      clearDiskCache: jest.fn(async () => true),
      clearMemoryCache: jest.fn(async () => true),
      getCachePathAsync: jest.fn(async () => null),
    },
  );
  return { Image };
});

// Icon fonts load through expo-font/expo-asset (native); render the glyph name as text.
jest.mock('@expo/vector-icons/Ionicons', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  const Ionicons = ({ name, ...props }: { name: string } & Record<string, unknown>) =>
    React.createElement(Text, props, name);
  return { __esModule: true, default: Ionicons };
});

jest.mock('react-native-safe-area-context', () => {
  // The library's official mock is an ES default export.
  const mock = jest.requireActual<{ default: Record<string, unknown> }>(
    'react-native-safe-area-context/jest/mock',
  );
  return mock.default;
});

jest.mock('react-native-reanimated', () =>
  // Mapped to src/test/reanimatedModule.ts by jest.config.js.
  jest.requireActual('react-native-reanimated/mock'),
);

jest.mock('react-native-gesture-handler', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const passthrough = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  const chainable = (): Record<string, unknown> =>
    new Proxy({}, { get: () => () => chainable() }) as Record<string, unknown>;
  // v3 hook API: return the config so tests can invoke callbacks directly.
  const hook = (kind: string) => (config: Record<string, unknown>) => ({ kind, config });
  const compose = (...gestures: unknown[]) => ({ gestures });
  return {
    GestureHandlerRootView: (props: Record<string, unknown>) => React.createElement(View, props),
    GestureDetector: passthrough,
    Gesture: new Proxy({}, { get: () => () => chainable() }),
    usePanGesture: hook('pan'),
    usePinchGesture: hook('pinch'),
    useTapGesture: hook('tap'),
    useSimultaneousGestures: compose,
    useExclusiveGestures: compose,
    useCompetingGestures: compose,
    State: {},
    Directions: {},
  };
});

jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (fn: (...args: unknown[]) => void, ...args: unknown[]) => fn(...args),
}));

jest.mock('react-native-pager-view', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const PagerView = (props: Record<string, unknown> & { children?: React.ReactNode }) =>
    React.createElement(View, { testID: props.testID as string | undefined }, props.children);
  return { __esModule: true, default: PagerView };
});

jest.mock('expo-video', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const player = { play: jest.fn(), pause: jest.fn(), muted: false, loop: false };
  return {
    useVideoPlayer: (_source: unknown, setup?: (p: typeof player) => void) => {
      const [p] = React.useState(() => {
        setup?.(player);
        return player;
      });
      return p;
    },
    VideoView: (props: Record<string, unknown>) => React.createElement(View, props),
  };
});

/* ---------- msw ---------- */

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
