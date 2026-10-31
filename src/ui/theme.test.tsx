import { render, renderHook, screen, waitFor } from '@testing-library/react-native';
import * as RN from 'react-native';

import { navigationTheme } from './navigationTheme';
import { PlaceholderScreen } from './PlaceholderScreen';
import { getTheme, palettes, useTheme } from './theme';
import { useReducedMotion } from './useReducedMotion';

describe('theme', () => {
  it('uses DESIGN §5 tokens', async () => {
    expect(palettes.dark.background).toBe('#0f0f14');
    expect(palettes.light.background).toBe('#ffffff');
    expect(palettes.dark.accent).toBe('#00b8ff');
    expect(palettes.dark.like).toBe('#ff4930');
    expect(getTheme('dark').spacing).toEqual({ xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 });
    expect(getTheme('dark').radius).toMatchObject({ tile: 8, chip: 999, sheet: 16 });
  });

  it.each([
    ['dark', 'dark'],
    ['light', 'light'],
    [null, 'dark'],
    [undefined, 'dark'],
  ] as const)('getTheme(%p) → %s (dark default)', async (scheme, expected) => {
    expect(getTheme(scheme).scheme).toBe(expected);
  });

  it('useTheme follows the system scheme', async () => {
    const spy = jest.spyOn(RN, 'useColorScheme').mockReturnValue('light');
    const { result } = await renderHook(() => useTheme());
    expect(result.current.colors.background).toBe('#ffffff');
    spy.mockRestore();
  });

  it('maps onto a navigation theme', async () => {
    const nav = navigationTheme(getTheme('dark'));
    expect(nav.dark).toBe(true);
    expect(nav.colors).toMatchObject({ primary: '#00b8ff', background: '#0f0f14' });
  });
});

describe('useReducedMotion', () => {
  it('reads the accessibility preference', async () => {
    jest.spyOn(RN.AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const { result } = await renderHook(() => useReducedMotion());
    await waitFor(() => expect(result.current).toBe(true));
  });
});

describe('PlaceholderScreen', () => {
  it('shows the route name', async () => {
    await render(<PlaceholderScreen route="blog/[name]" detail="staff" />);
    expect(screen.getByText('blog/[name]')).toBeTruthy();
    expect(screen.getByText('staff')).toBeTruthy();
  });
});
