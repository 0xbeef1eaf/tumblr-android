import Constants from 'expo-constants';
import { z } from 'zod';

/**
 * Public runtime configuration. Metro only inlines `process.env.EXPO_PUBLIC_*` when the
 * variable is referenced literally, so each one is read explicitly below.
 */
const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export const EnvSchema = z.object({
  EXPO_PUBLIC_TUMBLR_API_KEY: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  EXPO_PUBLIC_TOKEN_EXCHANGE_URL: z.preprocess(emptyToUndefined, z.url().optional()),
  EXPO_PUBLIC_TUMBLR_CLIENT_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  /** Forks registering their own callback URL; must be https (Tumblr rejects other schemes). */
  EXPO_PUBLIC_OAUTH_REDIRECT_URI: z.preprocess(
    emptyToUndefined,
    z.url({ protocol: /^https$/, error: 'must be an https:// URL' }).optional(),
  ),
});

/**
 * Build-time fallbacks. All optional: normally the user enters their own Tumblr app's
 * consumer key/secret in Settings (`src/api/credentials.ts`); these only pre-configure a
 * distributed build.
 */
export interface Env {
  tumblrApiKey?: string;
  tokenExchangeUrl?: string;
  tumblrClientSecret?: string;
  /** Overrides `OAUTH_REDIRECT_URI` (src/api/auth.ts) for forks. */
  oauthRedirectUri?: string;
  appVersion: string;
  isTest: boolean;
}

export type RawEnv = Partial<Record<keyof z.input<typeof EnvSchema>, string | undefined>>;

/** Validate a raw env record. Every value is optional; a malformed proxy or callback URL still throws. */
export function parseEnv(raw: RawEnv, options: { isTest: boolean; appVersion: string }): Env {
  const result = EnvSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration — ${issues}. See .env.example.`);
  }
  return {
    tumblrApiKey: result.data.EXPO_PUBLIC_TUMBLR_API_KEY,
    tokenExchangeUrl: result.data.EXPO_PUBLIC_TOKEN_EXCHANGE_URL,
    tumblrClientSecret: result.data.EXPO_PUBLIC_TUMBLR_CLIENT_SECRET,
    oauthRedirectUri: result.data.EXPO_PUBLIC_OAUTH_REDIRECT_URI,
    appVersion: options.appVersion,
    isTest: options.isTest,
  };
}

export const env: Env = parseEnv(
  {
    EXPO_PUBLIC_TUMBLR_API_KEY: process.env.EXPO_PUBLIC_TUMBLR_API_KEY,
    EXPO_PUBLIC_TOKEN_EXCHANGE_URL: process.env.EXPO_PUBLIC_TOKEN_EXCHANGE_URL,
    EXPO_PUBLIC_TUMBLR_CLIENT_SECRET: process.env.EXPO_PUBLIC_TUMBLR_CLIENT_SECRET,
    EXPO_PUBLIC_OAUTH_REDIRECT_URI: process.env.EXPO_PUBLIC_OAUTH_REDIRECT_URI,
  },
  {
    isTest: process.env.NODE_ENV === 'test',
    appVersion: Constants.expoConfig?.version ?? '1.0.0',
  },
);
