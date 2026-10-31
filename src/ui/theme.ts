import { useColorScheme } from 'react-native';

/** Design tokens (DESIGN §5). Dark is the default — galleries look better on dark. */
export type ColorScheme = 'light' | 'dark';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceRaised: string;
  text: string;
  textSecondary: string;
  border: string;
  accent: string;
  onAccent: string;
  like: string;
  danger: string;
  overlay: string;
  scrim: string;
  skeleton: string;
  skeletonHighlight: string;
}

export const palettes: Record<ColorScheme, ThemeColors> = {
  dark: {
    background: '#0f0f14',
    surface: '#1a1a22',
    surfaceRaised: '#24242e',
    text: '#f5f5f7',
    textSecondary: 'rgba(245, 245, 247, 0.6)',
    border: 'rgba(245, 245, 247, 0.12)',
    accent: '#00b8ff',
    onAccent: '#0f0f14',
    like: '#ff4930',
    danger: '#ff4930',
    overlay: 'rgba(0, 0, 0, 0.45)',
    scrim: 'rgba(0, 0, 0, 0.6)',
    skeleton: '#1a1a22',
    skeletonHighlight: '#24242e',
  },
  light: {
    background: '#ffffff',
    surface: '#f4f4f6',
    surfaceRaised: '#ffffff',
    text: '#111118',
    textSecondary: 'rgba(17, 17, 24, 0.6)',
    border: 'rgba(17, 17, 24, 0.12)',
    accent: '#00b8ff',
    onAccent: '#ffffff',
    like: '#ff4930',
    danger: '#d93a23',
    overlay: 'rgba(0, 0, 0, 0.35)',
    scrim: 'rgba(0, 0, 0, 0.5)',
    skeleton: '#f4f4f6',
    skeletonHighlight: '#e8e8ec',
  },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const fontSize = { xs: 12, sm: 14, md: 16, lg: 20, xl: 24 } as const;

export const fontWeight = { regular: '400', semibold: '600' } as const;

export const radius = { tile: 8, chip: 999, sheet: 16, sm: 4 } as const;

export const layout = {
  /** Gutter between gallery tiles (dp). */
  gutter: 4,
  /** Outer margin of galleries (dp). */
  outerMargin: 8,
  /** Minimum touch target (dp). */
  minHitTarget: 44,
  /** Width at which the default grid switches from 2 to 3 columns (dp). */
  wideBreakpoint: 600,
} as const;

export const motion = { fast: 150, normal: 200, slow: 300 } as const;

export interface Theme {
  scheme: ColorScheme;
  dark: boolean;
  colors: ThemeColors;
  spacing: typeof spacing;
  fontSize: typeof fontSize;
  fontWeight: typeof fontWeight;
  radius: typeof radius;
  layout: typeof layout;
  motion: typeof motion;
}

const themes: Record<ColorScheme, Theme> = {
  dark: {
    scheme: 'dark',
    dark: true,
    colors: palettes.dark,
    spacing,
    fontSize,
    fontWeight,
    radius,
    layout,
    motion,
  },
  light: {
    scheme: 'light',
    dark: false,
    colors: palettes.light,
    spacing,
    fontSize,
    fontWeight,
    radius,
    layout,
    motion,
  },
};

export function getTheme(scheme: ColorScheme | null | undefined): Theme {
  return themes[scheme === 'light' ? 'light' : 'dark'];
}

/** Current theme following the system scheme (dark when unknown). */
export function useTheme(): Theme {
  return getTheme(useColorScheme());
}
