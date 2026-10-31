import { useEffect, useRef, type ComponentRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Icon, Pressable } from '@/ui/primitives';
import { fontSize, radius, spacing, useTheme } from '@/ui/theme';

export const SEARCH_DEBOUNCE_MS = 300;

export interface SearchBarProps {
  value: string;
  /** Immediate, every keystroke. */
  onChangeText: (text: string) => void;
  /** Fires `debounceMs` after typing stops (immediately when the text becomes empty). */
  onDebouncedChange: (text: string) => void;
  onSubmit: (text: string) => void;
  onClear: () => void;
  autoFocus?: boolean;
  debounceMs?: number;
}

export function SearchBar({
  value,
  onChangeText,
  onDebouncedChange,
  onSubmit,
  onClear,
  autoFocus = true,
  debounceMs = SEARCH_DEBOUNCE_MS,
}: SearchBarProps) {
  const { colors } = useTheme();
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  // Always call the latest callback without restarting the debounce timer.
  const latest = useRef(onDebouncedChange);
  useEffect(() => {
    latest.current = onDebouncedChange;
  });

  useEffect(() => {
    if (value.trim() === '') {
      latest.current(value);
      return undefined;
    }
    const timer = setTimeout(() => latest.current(value), debounceMs);
    return () => clearTimeout(timer);
  }, [value, debounceMs]);

  return (
    <View style={[styles.bar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Icon name="search" size={20} tone="textSecondary" />
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={() => onSubmit(value)}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        placeholder="Search tags and blogs"
        placeholderTextColor={colors.textSecondary}
        accessibilityLabel="Search tags and blogs"
        style={[styles.input, { color: colors.text }]}
        testID="search-input"
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => {
            onClear();
            inputRef.current?.focus();
          }}
          accessibilityLabel="Clear search"
          hitSlop={8}
          testID="search-clear"
        >
          <Icon name="close-circle" size={20} tone="textSecondary" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    paddingLeft: spacing.md,
    borderRadius: radius.chip,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
  input: { flex: 1, fontSize: fontSize.md, paddingVertical: spacing.sm },
});
