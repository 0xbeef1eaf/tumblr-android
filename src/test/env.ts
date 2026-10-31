// Runs before any module is loaded (jest `setupFiles`). CI uses a dummy key; never a real one.
process.env.EXPO_PUBLIC_TUMBLR_API_KEY = process.env.EXPO_PUBLIC_TUMBLR_API_KEY || 'test';
