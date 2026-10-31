import { StyleSheet, View } from 'react-native';

import { Icon, Text, type IconName } from '@/ui/primitives';
import { spacing } from '@/ui/theme';

import { SignInButton } from './SignInButton';

export interface SignInPromptProps {
  icon?: IconName;
  title: string;
  body: string;
}

/** Centered "sign in to use this" panel for guest mode. */
export function SignInPrompt({ icon = 'person-circle-outline', title, body }: SignInPromptProps) {
  return (
    <View style={styles.root} testID="sign-in-prompt">
      <Icon name={icon} size={56} tone="textSecondary" />
      <Text variant="heading" align="center">
        {title}
      </Text>
      <Text variant="body" tone="secondary" align="center">
        {body}
      </Text>
      <SignInButton />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
});
