import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { fontSize, fontWeight, useTheme, type ThemeColors } from '../theme';

export type TextVariant = 'title' | 'heading' | 'body' | 'bodyStrong' | 'label' | 'caption';
export type TextTone = 'primary' | 'secondary' | 'accent' | 'like' | 'danger' | 'onAccent';

export const textVariants: Record<TextVariant, TextStyle> = {
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.semibold, lineHeight: 30 },
  heading: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, lineHeight: 26 },
  body: { fontSize: fontSize.md, fontWeight: fontWeight.regular, lineHeight: 22 },
  bodyStrong: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, lineHeight: 22 },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, lineHeight: 18 },
  caption: { fontSize: fontSize.xs, fontWeight: fontWeight.regular, lineHeight: 16 },
};

const toneColor: Record<TextTone, keyof ThemeColors> = {
  primary: 'text',
  secondary: 'textSecondary',
  accent: 'accent',
  like: 'like',
  danger: 'danger',
  onAccent: 'onAccent',
};

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  tone?: TextTone;
  align?: TextStyle['textAlign'];
}

export function Text({ variant = 'body', tone = 'primary', align, style, ...rest }: TextProps) {
  const { colors } = useTheme();
  return (
    <RNText
      {...rest}
      style={[
        textVariants[variant],
        { color: colors[toneColor[tone]] },
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}
