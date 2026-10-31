import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { normalizeCredentials, type TumblrCredentials } from '@/api/credentials';
import { Icon, Pressable, Sheet, Text } from '@/ui/primitives';
import { fontSize, radius, spacing, useTheme } from '@/ui/theme';

export interface CredentialsSheetProps {
  visible: boolean;
  /** Prefill (the credentials currently entered in Settings). */
  initial?: TumblrCredentials | null;
  isSaving?: boolean;
  onSave: (credentials: TumblrCredentials) => void;
  onCancel: () => void;
}

/**
 * Entry for the user's own Tumblr app: consumer key (visible) and consumer secret (hidden,
 * with a show toggle). Values are trimmed; the key is required, the secret optional (it is
 * only needed to sign in). Remount (`key`) to reset the fields when reopening.
 */
export function CredentialsSheet({
  visible,
  initial,
  isSaving = false,
  onSave,
  onCancel,
}: CredentialsSheetProps) {
  const { colors } = useTheme();
  const [consumerKey, setConsumerKey] = useState(initial?.consumerKey ?? '');
  const [consumerSecret, setConsumerSecret] = useState(initial?.consumerSecret ?? '');
  const [showSecret, setShowSecret] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputStyle = [
    styles.input,
    { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
  ];

  const save = () => {
    const next = normalizeCredentials({ consumerKey, consumerSecret });
    if (!next) {
      setError('Enter the OAuth consumer key of your Tumblr app');
      return;
    }
    onSave(next);
  };

  return (
    <Sheet
      visible={visible}
      onClose={onCancel}
      title="Tumblr API credentials"
      testID="credentials-sheet"
    >
      <Text variant="label" tone="secondary" style={styles.label}>
        Consumer key
      </Text>
      <TextInput
        value={consumerKey}
        onChangeText={(text) => {
          setConsumerKey(text);
          setError(null);
        }}
        placeholder="OAuth consumer key"
        placeholderTextColor={colors.textSecondary}
        accessibilityLabel="Consumer key"
        autoCapitalize="none"
        autoCorrect={false}
        style={inputStyle}
        testID="input-consumer-key"
      />
      <Text variant="label" tone="secondary" style={styles.label}>
        Consumer secret
      </Text>
      <View style={styles.secretRow}>
        <TextInput
          value={consumerSecret}
          onChangeText={setConsumerSecret}
          placeholder="Needed to sign in (optional)"
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel="Consumer secret"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={!showSecret}
          style={[inputStyle, styles.secretInput]}
          testID="input-consumer-secret"
        />
        <Pressable
          onPress={() => setShowSecret((value) => !value)}
          accessibilityLabel={showSecret ? 'Hide secret' : 'Show secret'}
          style={styles.toggle}
          testID="toggle-secret"
        >
          <Icon name={showSecret ? 'eye-off-outline' : 'eye-outline'} size={22} />
        </Pressable>
      </View>
      {error ? (
        <Text variant="caption" tone="danger" style={styles.error} testID="credentials-error">
          {error}
        </Text>
      ) : null}
      <Text variant="caption" tone="secondary" style={styles.note}>
        Stored only on this device, in encrypted secure storage. Saving signs you out.
      </Text>
      <View style={styles.actions}>
        <Pressable onPress={onCancel} accessibilityLabel="Cancel" style={styles.button}>
          <Text variant="bodyStrong" tone="secondary">
            Cancel
          </Text>
        </Pressable>
        <Pressable
          onPress={save}
          disabled={isSaving}
          accessibilityLabel="Save credentials"
          style={[styles.button, styles.confirm, { backgroundColor: colors.accent }]}
          testID="credentials-save"
        >
          <Text variant="bodyStrong" tone="onAccent">
            {isSaving ? 'Saving…' : 'Save'}
          </Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: spacing.xs },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.tile,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    marginBottom: spacing.md,
  },
  secretRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  secretInput: { flex: 1 },
  toggle: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs },
  error: { marginBottom: spacing.sm },
  note: { marginBottom: spacing.lg },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md },
  button: { paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center' },
  confirm: { borderRadius: radius.chip },
});
