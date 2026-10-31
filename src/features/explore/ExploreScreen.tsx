import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { avatarUrl } from '@/api/endpoints/blog';
import { useSession } from '@/features/auth';
import { ConnectAppCard } from '@/features/credentials/ConnectAppCard';
import { useApiKeyStatus } from '@/features/credentials/credentialsState';
import { Pressable, Text } from '@/ui/primitives';
import { radius, spacing, useTheme } from '@/ui/theme';

import { FollowingRow } from './FollowingRow';
import { RecentChips } from './RecentChips';
import { StarterTags } from './StarterTags';

export const APP_NAME = 'Tumblr Gallery';

function HeaderAccount() {
  const { colors } = useTheme();
  const router = useRouter();
  const { status, user, signIn } = useSession();
  if (status === 'signedIn') {
    const blog = user?.primaryBlog ?? user?.name;
    const uri = user?.avatarUrl ?? (blog ? avatarUrl(blog, 64) : undefined);
    return (
      <Pressable
        onPress={() => (blog ? router.push(`/blog/${encodeURIComponent(blog)}`) : undefined)}
        accessibilityLabel={`Your blog${blog ? `, ${blog}` : ''}`}
        testID="account-avatar"
      >
        <Image
          source={uri ? { uri } : undefined}
          style={[styles.avatar, { backgroundColor: colors.surface }]}
          contentFit="cover"
        />
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={() => void signIn()}
      disabled={status === 'loading'}
      accessibilityLabel="Sign in"
      testID="sign-in"
      style={[styles.signIn, { borderColor: colors.accent }]}
    >
      <Text variant="label" tone="accent">
        Sign in
      </Text>
    </Pressable>
  );
}

export interface ExploreScreenProps {
  /** Override the delay between starter-tag preview requests (tests). */
  previewStaggerMs?: number;
}

/**
 * Explore tab (`/`): recents, followed blogs and curated starter tags (DESIGN §3.1). Without a
 * consumer key the starter tags (which need `api_key`) give way to the "Connect" card.
 */
export function ExploreScreen({ previewStaggerMs }: ExploreScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const apiKey = useApiKeyStatus();
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: spacing.xl },
        ]}
      >
        <View style={styles.header}>
          <Text variant="title" accessibilityRole="header">
            {APP_NAME}
          </Text>
          <HeaderAccount />
        </View>
        <RecentChips />
        <FollowingRow />
        {apiKey.missing ? (
          <ConnectAppCard />
        ) : apiKey.hasApiKey ? (
          <View style={styles.section}>
            <Text variant="heading" style={styles.sectionTitle}>
              Start here
            </Text>
            <StarterTags staggerMs={previewStaggerMs} />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  signIn: {
    borderWidth: 1,
    borderRadius: radius.chip,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  section: { gap: spacing.sm },
  sectionTitle: { paddingHorizontal: spacing.md },
});
