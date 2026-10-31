import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/ui/primitives';
import { spacing, useTheme } from '@/ui/theme';

export default function NotFoundScreen() {
  const { colors } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Text variant="heading" align="center">
        +not-found
      </Text>
      <Text tone="secondary" align="center" style={styles.body}>
        This screen doesn’t exist.
      </Text>
      <Link href="/" style={[styles.link, { color: colors.accent }]}>
        Go to Explore
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  body: { marginTop: spacing.sm },
  link: { marginTop: spacing.lg, fontSize: 16, padding: spacing.md },
});
