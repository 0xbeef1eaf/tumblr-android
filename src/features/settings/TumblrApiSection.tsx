import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { getOAuthRedirectUri } from '@/api/auth';
import type { CredentialsSource } from '@/api/credentials';
import { useCredentialsStore } from '@/features/credentials/credentialsState';
import { Icon, Text, toast } from '@/ui/primitives';
import { spacing } from '@/ui/theme';

import { ConfirmSheet } from './ConfirmSheet';
import { CredentialsSheet } from './CredentialsSheet';
import { SettingsRow } from './SettingsRow';
import { SettingsSection } from './SettingsSection';
import { useCredentialActions } from './useCredentialActions';

export const TUMBLR_APPS_URL = 'https://www.tumblr.com/oauth/apps';
/** Suggested "Application Website" for the user's Tumblr app registration. */
export const APP_WEBSITE_URL = 'https://github.com/0xbeef1eaf/tumblr-android';

export const STATUS_COPY: Record<CredentialsSource, { label: string; description: string }> = {
  user: {
    label: 'Using your credentials',
    description: 'Requests use the Tumblr app you entered below.',
  },
  env: {
    label: 'Using built-in key',
    description: 'This build ships a consumer key. Enter your own to use your app instead.',
  },
  none: {
    label: 'Not configured',
    description: 'Register a Tumblr app (steps below) and enter its consumer key to browse.',
  },
};

export const STEPS = [
  'Open the Tumblr apps page and choose “Register application”.',
  `Fill in any name and description. The Application Website can be ${APP_WEBSITE_URL}.`,
  'Paste the callback URL below as the “Default callback URL”, exactly as shown. Nothing needs to exist at it: sign-in runs in an in-app browser that catches it.',
  'Save, then copy the OAuth consumer key and consumer secret into the fields above.',
];

/** Short, recognisable form of a consumer key ("abcd…wxyz"). */
export function maskKey(key: string): string {
  return key.length <= 10 ? key : `${key.slice(0, 4)}…${key.slice(-4)}`;
}

/** Settings → Tumblr API: the user's own consumer key/secret (DESIGN §3.8). */
export function TumblrApiSection() {
  const source = useCredentialsStore((s) => s.source);
  const credentials = useCredentialsStore((s) => s.credentials);
  const loading = useCredentialsStore((s) => s.status === 'loading');
  const actions = useCredentialActions();
  const [editing, setEditing] = useState(false);
  const [sheetKey, setSheetKey] = useState(0);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const status = STATUS_COPY[source];
  const callbackUrl = getOAuthRedirectUri();

  const edit = () => {
    setSheetKey((key) => key + 1);
    setEditing(true);
  };

  const copyCallback = async () => {
    try {
      await Clipboard.setStringAsync(callbackUrl);
      toast.success('Callback URL copied');
    } catch {
      toast.error('Could not copy the callback URL');
    }
  };

  return (
    <>
      <SettingsSection title="Tumblr API" testID="section-tumblr-api">
        <SettingsRow
          label={loading ? 'Checking…' : status.label}
          description={loading ? undefined : status.description}
          testID="row-credentials-status"
        />
        <SettingsRow
          label="Consumer key"
          description={credentials ? maskKey(credentials.consumerKey) : 'Not set'}
          onPress={edit}
          testID="row-consumer-key"
        />
        <SettingsRow
          label="Consumer secret"
          description={
            credentials?.consumerSecret ? 'Saved on this device' : 'Not set: needed to sign in'
          }
          onPress={edit}
          testID="row-consumer-secret"
        />
        {credentials ? (
          <SettingsRow
            label="Remove credentials"
            description="Deletes them from this device and signs you out"
            tone="danger"
            onPress={() => setConfirmRemove(true)}
            testID="row-remove-credentials"
          />
        ) : null}
        <View style={styles.help} testID="credentials-help">
          <Text variant="label">Set up your Tumblr app</Text>
          {STEPS.map((step, index) => (
            <Text key={step} variant="caption" tone="secondary">
              {`${index + 1}. ${step}`}
            </Text>
          ))}
        </View>
        <SettingsRow
          label="Callback URL"
          description={callbackUrl}
          onPress={() => void copyCallback()}
          trailing={<Icon name="copy-outline" size={20} tone="textSecondary" />}
          testID="row-callback-url"
        />
        <SettingsRow
          label="Open Tumblr apps page"
          tone="accent"
          onPress={() => void Linking.openURL(TUMBLR_APPS_URL)}
          testID="row-tumblr-apps"
        />
      </SettingsSection>
      <CredentialsSheet
        key={sheetKey}
        visible={editing}
        initial={credentials}
        isSaving={actions.isSaving}
        onCancel={() => setEditing(false)}
        onSave={(next) => {
          const unchanged =
            next.consumerKey === credentials?.consumerKey &&
            next.consumerSecret === credentials?.consumerSecret;
          // Re-saving the same values must not sign the user out.
          if (unchanged) return setEditing(false);
          void actions.save(next).then((saved) => {
            if (saved) setEditing(false);
          });
        }}
      />
      <ConfirmSheet
        visible={confirmRemove}
        title="Remove your credentials?"
        message="Your consumer key and secret are deleted from this device and you are signed out."
        confirmLabel="Remove"
        onConfirm={() => {
          setConfirmRemove(false);
          void actions.remove();
        }}
        onCancel={() => setConfirmRemove(false)}
        testID="confirm-remove-credentials"
      />
    </>
  );
}

const styles = StyleSheet.create({
  help: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.xs },
});
