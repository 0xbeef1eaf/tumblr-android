// Runs before any module is loaded (jest `setupFiles`). Tests never use build-time
// credentials: `src/test/setup.ts` seeds the credentials store with `{ consumerKey: 'test' }`
// before each test, and tests that need env fallbacks pass an `Env` explicitly.
delete process.env.EXPO_PUBLIC_TUMBLR_API_KEY;
delete process.env.EXPO_PUBLIC_TUMBLR_CLIENT_SECRET;
delete process.env.EXPO_PUBLIC_TOKEN_EXCHANGE_URL;
delete process.env.EXPO_PUBLIC_OAUTH_REDIRECT_URI;
