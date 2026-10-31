import Constants from 'expo-constants';
import { z } from 'zod';

/**
 * Public runtime configuration. Metro only inlines `process.env.EXPO_PUBLIC_*` when the
 * variable is referenced literally, so each one is read explicitly below.
 */
const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export const EnvSchema = z.object({
  EXPO_PUBLIC_TUMBLR_API_KEY: z.string().min(1, 'EXPO_PUBLIC_TUMBLR_API_KEY is required'),
  EXPO_PUBLIC_TOKEN_EXCHANGE_URL: z.preprocess(emptyToUndefined, z.url().optional()),
  EXPO_PUBLIC_TUMBLR_CLIENT_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
});

export interface Env {
  tumblrApiKey: string;
  tokenExchangeUrl?: string;
  tumblrClientSecret?: string;
  appVersion: string;
  isTest: boolean;
}

export type RawEnv = Partial<Record<keyof z.input<typeof EnvSchema>, string | undefined>>;

/** Validate a raw env record. In tests a missing API key defaults to `'test'`. */
export function parseEnv(raw: RawEnv, options: { isTest: boolean; appVersion: string }): Env {
  const input = {
    ...raw,
    EXPO_PUBLIC_TUMBLR_API_KEY:
      emptyToUndefined(raw.EXPO_PUBLIC_TUMBLR_API_KEY) ?? (options.isTest ? 'test' : undefined),
  };
  const result = EnvSchema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration — ${issues}. See .env.example.`);
  }
  return {
    tumblrApiKey: result.data.EXPO_PUBLIC_TUMBLR_API_KEY,
    tokenExchangeUrl: result.data.EXPO_PUBLIC_TOKEN_EXCHANGE_URL,
    tumblrClientSecret: result.data.EXPO_PUBLIC_TUMBLR_CLIENT_SECRET,
    appVersion: options.appVersion,
    isTest: options.isTest,
  };
}

export const env: Env = parseEnv(
  {
    EXPO_PUBLIC_TUMBLR_API_KEY: process.env.EXPO_PUBLIC_TUMBLR_API_KEY,
    EXPO_PUBLIC_TOKEN_EXCHANGE_URL: process.env.EXPO_PUBLIC_TOKEN_EXCHANGE_URL,
    EXPO_PUBLIC_TUMBLR_CLIENT_SECRET: process.env.EXPO_PUBLIC_TUMBLR_CLIENT_SECRET,
  },
  {
    isTest: process.env.NODE_ENV === 'test',
    appVersion: Constants.expoConfig?.version ?? '1.0.0',
  },
);
