import { useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { Pressable, Text } from '@/ui/primitives';
import { radius, spacing, useTheme } from '@/ui/theme';

import { useSession } from './useSession';

export interface SignInButtonProps {
  label?: string;
}

/** Primary "Sign in with Tumblr" button; shows a spinner while the sign-in flow runs. */
export function SignInButton({ label = 'Sign in with Tumblr' }: SignInButtonProps) {
  const { colors } = useTheme();
  const { signIn } = useSession();
  const [busy, setBusy] = useState(false);

  const onPress = async () => {
    setBusy(true);
    try {
      await signIn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityLabel={label}
      style={[styles.button, { backgroundColor: colors.accent }]}
    >
      {busy ? (
        <ActivityIndicator color={colors.onAccent} />
      ) : (
        <Text variant="bodyStrong" tone="onAccent">
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.chip,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
