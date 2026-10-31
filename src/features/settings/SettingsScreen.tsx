import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSession } from '@/features/auth';
import { Text } from '@/ui/primitives';
import { spacing, useTheme } from '@/ui/theme';

import { ColumnsControl } from './ColumnsControl';
import { ConfirmSheet } from './ConfirmSheet';
import { SettingsRow, SettingsSwitchRow } from './SettingsRow';
import { SettingsSection } from './SettingsSection';
import { useSettingsStore } from './settingsStore';
import { useStorageActions, type StorageAction } from './useStorageActions';

export const API_TERMS_URL = 'https://www.tumblr.com/docs/en/api_agreement';
export const API_DOCS_URL = 'https://github.com/tumblr/docs';

const CONFIRM_COPY: Record<StorageAction, { title: string; message: string; label: string }> = {
  cache: {
    title: 'Clear image cache?',
    message: 'Downloaded images will be fetched again the next time you view them.',
    label: 'Clear cache',
  },
  history: {
    title: 'Clear search history?',
    message: 'Your recent searches will be removed from this device.',
    label: 'Clear history',
  },
};

function AccountSection() {
  const { status, user, signIn, signOut } = useSession();
  if (status === 'signedIn') {
    const blog = user?.primaryBlog ?? user?.name;
    return (
      <SettingsSection title="Account" testID="section-account">
        <SettingsRow
          label="Sign out"
          description={blog ? `Signed in as ${blog}` : 'Signed in'}
          tone="danger"
          onPress={() => void signOut()}
          testID="row-sign-out"
        />
      </SettingsSection>
    );
  }
  return (
    <SettingsSection title="Account" testID="section-account">
      <SettingsRow
        label="Sign in to Tumblr"
        description={
          status === 'loading'
            ? 'Checking your session…'
            : 'Browsing works without an account. Sign in for your dashboard, likes and follows.'
        }
        tone="accent"
        disabled={status === 'loading'}
        onPress={() => void signIn()}
        testID="row-sign-in"
      />
    </SettingsSection>
  );
}

function GridSection() {
  const columns = useSettingsStore((s) => s.columns);
  const setColumns = useSettingsStore((s) => s.setColumns);
  const showBlogName = useSettingsStore((s) => s.showBlogName);
  const setShowBlogName = useSettingsStore((s) => s.setShowBlogName);
  return (
    <SettingsSection title="Grid" testID="section-grid">
      <SettingsRow
        label="Columns"
        trailing={<ColumnsControl value={columns} onChange={setColumns} />}
      />
      <SettingsSwitchRow
        label="Show blog name"
        description="Overlay the blog name on gallery tiles"
        value={showBlogName}
        onValueChange={setShowBlogName}
        testID="row-show-blog-name"
      />
    </SettingsSection>
  );
}

function ContentSection() {
  const safeMode = useSettingsStore((s) => s.safeMode);
  const setSafeMode = useSettingsStore((s) => s.setSafeMode);
  const gifs = useSettingsStore((s) => s.autoplayGifsOnCellular);
  const setGifs = useSettingsStore((s) => s.setAutoplayGifsOnCellular);
  const video = useSettingsStore((s) => s.autoplayVideo);
  const setVideo = useSettingsStore((s) => s.setAutoplayVideo);
  return (
    <SettingsSection title="Content" testID="section-content">
      <SettingsSwitchRow
        label="Safe mode"
        description="Blur posts flagged as sensitive"
        value={safeMode}
        onValueChange={setSafeMode}
        testID="row-safe-mode"
      />
      <SettingsSwitchRow
        label="Autoplay GIFs on cellular"
        value={gifs}
        onValueChange={setGifs}
        testID="row-autoplay-gifs"
      />
      <SettingsSwitchRow
        label="Autoplay video"
        value={video}
        onValueChange={setVideo}
        testID="row-autoplay-video"
      />
    </SettingsSection>
  );
}

function AboutSection() {
  const version = Constants.expoConfig?.version ?? '1.0.0';
  return (
    <SettingsSection title="About" testID="section-about">
      <SettingsRow label="Version" trailing={<Text tone="secondary">{version}</Text>} />
      <SettingsRow
        label="Tumblr API terms"
        onPress={() => void Linking.openURL(API_TERMS_URL)}
        testID="row-api-terms"
      />
      <SettingsRow
        label="Tumblr API documentation"
        onPress={() => void Linking.openURL(API_DOCS_URL)}
        testID="row-api-docs"
      />
      <SettingsRow
        label="Open-source licences"
        description="Tumblr Gallery is MIT licensed and built on Expo, React Native and other open-source packages; see the repository for each licence."
      />
    </SettingsSection>
  );
}

/** Settings tab (DESIGN §3.8). */
export function SettingsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const storage = useStorageActions();
  const copy = storage.pending ? CONFIRM_COPY[storage.pending] : null;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]} testID="settings-screen">
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xxl },
        ]}
      >
        <Text variant="title" accessibilityRole="header" style={styles.heading}>
          Settings
        </Text>
        <AccountSection />
        <GridSection />
        <ContentSection />
        <SettingsSection title="Storage" testID="section-storage">
          <SettingsRow
            label="Clear image cache"
            onPress={() => storage.request('cache')}
            testID="row-clear-cache"
          />
          <SettingsRow
            label="Clear search history"
            onPress={() => storage.request('history')}
            testID="row-clear-history"
          />
        </SettingsSection>
        <AboutSection />
      </ScrollView>
      <ConfirmSheet
        visible={copy !== null}
        title={copy?.title ?? ''}
        message={copy?.message ?? ''}
        confirmLabel={copy?.label ?? 'Confirm'}
        onConfirm={() => void storage.confirm()}
        onCancel={storage.cancel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: spacing.lg },
  heading: { marginBottom: spacing.xl },
});
