import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing, useTheme } from '../theme';

import { Icon, type IconName } from './Icon';
import { Pressable } from './Pressable';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  onPress?: () => void;
  onLongPress?: () => void;
  selected?: boolean;
  icon?: IconName;
  /** Trailing remove button (e.g. recent searches). */
  onRemove?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

export function Chip({
  label,
  onPress,
  onLongPress,
  selected = false,
  icon,
  onRemove,
  style,
  testID,
  accessibilityLabel,
}: ChipProps) {
  const { colors } = useTheme();
  const foreground = selected ? colors.onAccent : colors.text;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      testID={testID}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        { backgroundColor: selected ? colors.accent : colors.surface, borderColor: colors.border },
        style,
      ]}
    >
      <View style={styles.row}>
        {icon ? <Icon name={icon} size={16} color={foreground} /> : null}
        <Text variant="label" style={{ color: foreground }} numberOfLines={1}>
          {label}
        </Text>
        {onRemove ? (
          <Pressable
            onPress={onRemove}
            accessibilityLabel={`Remove ${label}`}
            hitSlop={8}
            noMinSize
            style={styles.remove}
          >
            <Icon name="close" size={14} color={foreground} />
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: radius.chip,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  remove: { marginLeft: spacing.xs },
});
