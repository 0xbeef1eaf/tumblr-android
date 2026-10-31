import { env, parseEnv } from './env';

const opts = { isTest: false, appVersion: '2.0.0' };

describe('parseEnv', () => {
  it('reads all values', () => {
    expect(
      parseEnv(
        {
          EXPO_PUBLIC_TUMBLR_API_KEY: 'key',
          EXPO_PUBLIC_TOKEN_EXCHANGE_URL: 'https://proxy.example.com/token',
          EXPO_PUBLIC_TUMBLR_CLIENT_SECRET: 'secret',
        },
        opts,
      ),
    ).toEqual({
      tumblrApiKey: 'key',
      tokenExchangeUrl: 'https://proxy.example.com/token',
      tumblrClientSecret: 'secret',
      appVersion: '2.0.0',
      isTest: false,
    });
  });

  it('treats empty strings as unset', () => {
    const parsed = parseEnv(
      {
        EXPO_PUBLIC_TUMBLR_API_KEY: 'key',
        EXPO_PUBLIC_TOKEN_EXCHANGE_URL: '',
        EXPO_PUBLIC_TUMBLR_CLIENT_SECRET: ' ',
      },
      opts,
    );
    expect(parsed.tokenExchangeUrl).toBeUndefined();
    expect(parsed.tumblrClientSecret).toBeUndefined();
  });

  it('accepts an empty environment (credentials come from Settings)', () => {
    expect(parseEnv({}, opts)).toEqual({ appVersion: '2.0.0', isTest: false });
    expect(parseEnv({ EXPO_PUBLIC_TUMBLR_API_KEY: '  ' }, opts).tumblrApiKey).toBeUndefined();
  });

  it('trims the API key', () => {
    expect(parseEnv({ EXPO_PUBLIC_TUMBLR_API_KEY: ' key ' }, opts).tumblrApiKey).toBe('key');
  });

  it('rejects a malformed proxy URL', () => {
    expect(() =>
      parseEnv(
        { EXPO_PUBLIC_TUMBLR_API_KEY: 'k', EXPO_PUBLIC_TOKEN_EXCHANGE_URL: 'not a url' },
        opts,
      ),
    ).toThrow(/EXPO_PUBLIC_TOKEN_EXCHANGE_URL/);
  });

  it('exposes the runtime env (no baked-in key under jest)', () => {
    expect(env.tumblrApiKey).toBeUndefined();
    expect(env.isTest).toBe(true);
  });
});
