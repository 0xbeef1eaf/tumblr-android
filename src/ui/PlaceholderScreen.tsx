import { StyleSheet, View } from 'react-native';

import { Text } from './primitives/Text';
import { spacing, useTheme } from './theme';

export interface PlaceholderScreenProps {
  /** Route name shown in the centre, e.g. `blog/[name]`. */
  route: string;
  detail?: string;
}

/** Temporary screen body for routes later work packages will fill in. */
export function PlaceholderScreen({ route, detail }: PlaceholderScreenProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]} testID="placeholder-screen">
      <Text variant="heading" align="center">
        {route}
      </Text>
      {detail ? (
        <Text variant="caption" tone="secondary" align="center" style={styles.detail}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  detail: { marginTop: spacing.sm },
});
