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

  it('requires the API key outside tests', () => {
    expect(() => parseEnv({}, opts)).toThrow(/EXPO_PUBLIC_TUMBLR_API_KEY/);
  });

  it("defaults the API key to 'test' under jest", () => {
    expect(parseEnv({}, { ...opts, isTest: true }).tumblrApiKey).toBe('test');
  });

  it('rejects a malformed proxy URL', () => {
    expect(() =>
      parseEnv(
        { EXPO_PUBLIC_TUMBLR_API_KEY: 'k', EXPO_PUBLIC_TOKEN_EXCHANGE_URL: 'not a url' },
        opts,
      ),
    ).toThrow(/EXPO_PUBLIC_TOKEN_EXCHANGE_URL/);
  });

  it('exposes the runtime env', () => {
    expect(env.tumblrApiKey).toBe('test');
    expect(env.isTest).toBe(true);
  });
});
