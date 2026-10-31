import {
  Pressable as RNPressable,
  type PressableProps as RNPressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { layout } from '../theme';

export interface PressableProps extends Omit<RNPressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** Opacity while pressed (default 0.6). */
  pressedOpacity?: number;
  /** Skip the 44 dp minimum size (e.g. full-bleed tiles that are already large). */
  noMinSize?: boolean;
}

const minSize: ViewStyle = { minWidth: layout.minHitTarget, minHeight: layout.minHitTarget };

/** RN Pressable with opacity feedback and a ≥ 44 dp hit target (DESIGN §6). */
export function Pressable({
  style,
  pressedOpacity = 0.6,
  noMinSize = false,
  accessibilityRole = 'button',
  disabled,
  ...rest
}: PressableProps) {
  return (
    <RNPressable
      {...rest}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled: Boolean(disabled), ...rest.accessibilityState }}
      style={({ pressed }) => [
        noMinSize ? null : minSize,
        style,
        pressed && !disabled ? { opacity: pressedOpacity } : null,
        disabled ? { opacity: 0.4 } : null,
      ]}
    />
  );
}
