import type { Env } from '@/lib/env';

import * as auth from './auth';
import { buildAuthorizeUrl, getOAuthRedirectUri, OAUTH_REDIRECT_URI } from './authorize';

const baseEnv: Env = { appVersion: '1.0.0', isTest: true };

describe('buildAuthorizeUrl', () => {
  it('builds the authorize URL with scopes, state and redirect', () => {
    const url = new URL(
      buildAuthorizeUrl({
        clientId: 'consumer-key',
        redirectUri: OAUTH_REDIRECT_URI,
        state: 'xyz',
      }),
    );
    expect(url.origin + url.pathname).toBe('https://www.tumblr.com/oauth2/authorize');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'consumer-key',
      response_type: 'code',
      scope: 'basic write offline_access',
      state: 'xyz',
      redirect_uri: 'https://0xbeef1eaf.github.io/tumblr-android/auth/callback',
    });
    const narrow = new URL(
      buildAuthorizeUrl({
        clientId: 'k',
        redirectUri: 'https://x.test/cb',
        state: 's',
        scopes: ['basic'],
      }),
    );
    expect(narrow.searchParams.get('scope')).toBe('basic');
  });
});

describe('OAuth redirect URI', () => {
  it('is an https identifier Tumblr accepts as the default callback URL', () => {
    expect(OAUTH_REDIRECT_URI).toBe('https://0xbeef1eaf.github.io/tumblr-android/auth/callback');
    expect(getOAuthRedirectUri(baseEnv)).toBe(OAUTH_REDIRECT_URI);
  });

  it('is re-exported from the auth module', () => {
    expect(auth.OAUTH_REDIRECT_URI).toBe(OAUTH_REDIRECT_URI);
    expect(auth.getOAuthRedirectUri).toBe(getOAuthRedirectUri);
  });

  it('honours the build override for forks', () => {
    const fork = 'https://fork.example.org/tumblr/callback';
    expect(getOAuthRedirectUri({ ...baseEnv, oauthRedirectUri: fork })).toBe(fork);
  });
});
