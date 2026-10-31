import { useRouter } from 'expo-router';

import { MessageView } from '@/features/tag/MessageView';

import { SETTINGS_ROUTE } from './navigation';

export const CONNECT_TITLE = 'Connect your Tumblr app';
export const CONNECT_BODY =
  'Tumblr Gallery uses your own Tumblr app. Add its consumer key in Settings to browse tags and blogs.';

export interface ConnectAppCardProps {
  testID?: string;
}

/** Onboarding card shown instead of galleries while no consumer key is configured (DESIGN §3.1). */
export function ConnectAppCard({ testID = 'connect-app' }: ConnectAppCardProps) {
  const router = useRouter();
  return (
    <MessageView
      icon="key-outline"
      title={CONNECT_TITLE}
      body={CONNECT_BODY}
      actionLabel="Open Settings"
      onAction={() => router.push(SETTINGS_ROUTE)}
      testID={testID}
    />
  );
}
