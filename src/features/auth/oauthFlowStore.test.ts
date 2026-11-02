import { OAuthError } from '@/api/auth';

import {
  isRedirectUrl,
  parseCallbackParams,
  useOAuthFlowStore,
  type OAuthFlowRequest,
} from './oauthFlowStore';

const CALLBACK = 'https://0xbeef1eaf.github.io/tumblr-android/auth/callback';
const request: OAuthFlowRequest = {
  url: 'https://www.tumblr.com/oauth2/authorize?state=s1',
  state: 's1',
  redirectUri: CALLBACK,
};
const flow = () => useOAuthFlowStore.getState();

afterEach(() => flow().cancel());

describe('useOAuthFlowStore', () => {
  it('settles once: dismissing after success neither rejects nor re-resolves', async () => {
    const result = flow().begin(request);
    const settled = jest.fn();
    void result.then(settled, settled);
    flow().complete(`${CALLBACK}?code=abc&state=s1`);
    flow().cancel(request);
    flow().cancel();
    flow().fail(new Error('late'));
    flow().complete(`${CALLBACK}?code=other&state=s1`);
    await expect(result).resolves.toEqual({
      status: 'success',
      code: 'abc',
      redirectUri: CALLBACK,
    });
    expect(settled).toHaveBeenCalledTimes(1);
    expect(flow().request).toBeNull();
  });

  it('ignores a cancel for a different flow', async () => {
    const result = flow().begin(request);
    flow().cancel({ ...request });
    expect(flow().request).toBe(request);
    flow().cancel(request);
    await expect(result).resolves.toEqual({ status: 'cancelled' });
  });

  it('rejects with OAuthError codes from the callback', async () => {
    const mismatch = flow().begin(request);
    flow().complete(`${CALLBACK}?code=abc&state=forged`);
    await expect(mismatch).rejects.toMatchObject({ code: 'state_mismatch' });

    const missing = flow().begin(request);
    flow().complete(`${CALLBACK}?state=s1`);
    await expect(missing).rejects.toBeInstanceOf(OAuthError);
  });

  it('fails the pending flow and is a no-op when idle', async () => {
    flow().complete(`${CALLBACK}?code=abc&state=s1`);
    flow().fail(new Error('nothing pending'));
    const result = flow().begin(request);
    flow().fail(new Error('boom'));
    await expect(result).rejects.toThrow('boom');
  });
});

describe('isRedirectUrl', () => {
  it.each([
    [CALLBACK, true],
    [`${CALLBACK}?code=a&state=b`, true],
    [`${CALLBACK}#frag`, true],
    [`${CALLBACK}/extra`, false],
    [`${CALLBACK}evil`, false],
    ['https://www.tumblr.com/oauth2/authorize?redirect_uri=x', false],
    ['http://0xbeef1eaf.github.io/tumblr-android/auth/callback?code=a', false],
  ])('%s → %p', (url, expected) => expect(isRedirectUrl(url, CALLBACK)).toBe(expected));
});

describe('parseCallbackParams', () => {
  it('decodes the query and ignores the fragment', () => {
    expect(
      parseCallbackParams(
        `${CALLBACK}?code=a%2Fb&state=s1&error_description=Access+was+denied&flag#state=nope`,
      ),
    ).toEqual({ code: 'a/b', state: 's1', error_description: 'Access was denied', flag: '' });
  });

  it('keeps the first value of a repeated key and survives bad escapes', () => {
    expect(parseCallbackParams(`${CALLBACK}?state=one&state=two&code=%E0%A4%A`)).toEqual({
      state: 'one',
      code: '%E0%A4%A',
    });
    expect(parseCallbackParams(CALLBACK)).toEqual({});
  });
});
