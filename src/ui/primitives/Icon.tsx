import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import { useTheme, type ThemeColors } from '../theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export interface IconProps {
  name: IconName;
  size?: number;
  /** Raw colour, or a theme colour key. Defaults to the primary text colour. */
  color?: string;
  tone?: keyof ThemeColors;
  accessibilityLabel?: string;
  testID?: string;
}

export function Icon({
  name,
  size = 24,
  color,
  tone = 'text',
  accessibilityLabel,
  testID,
}: IconProps) {
  const { colors } = useTheme();
  return (
    <Ionicons
      name={name}
      size={size}
      color={color ?? colors[tone]}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={!accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
      testID={testID}
    />
  );
}
