import { http, HttpResponse } from 'msw';
import { z } from 'zod';

import { API, fixtures, server } from '@/test/msw';

import {
  apiFetch,
  buildUrl,
  isMissingCredentialsError,
  MissingCredentialsError,
  setTokenProvider,
} from './client';
import { credentialsStore } from './credentials';

const Anything = z.unknown();

function captureTagged() {
  const requests: Request[] = [];
  server.use(
    http.get(`${API}/v2/tagged`, ({ request }) => {
      requests.push(request.clone());
      return HttpResponse.json(fixtures.tagged);
    }),
  );
  return requests;
}

afterEach(() => setTokenProvider(null));

describe('api_key from the credentials store', () => {
  it('reads the user-entered consumer key at request time', async () => {
    const requests = captureTagged();
    await credentialsStore.save({ consumerKey: '  my-own-key ', consumerSecret: 's' });
    await apiFetch('/v2/tagged', { query: { tag: 'cats' }, schema: Anything });
    expect(new URL(requests[0]?.url ?? '').searchParams.get('api_key')).toBe('my-own-key');
  });

  it('throws MissingCredentialsError before any request when no key is configured', async () => {
    const requests = captureTagged();
    await credentialsStore.clear();
    const error = await apiFetch('/v2/tagged', { schema: Anything }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MissingCredentialsError);
    expect(isMissingCredentialsError(error)).toBe(true);
    expect(requests).toHaveLength(0);
    expect(() => buildUrl('/v2/tagged', {}, 'apiKey')).toThrow(MissingCredentialsError);
  });

  it("still serves 'auto' guests without a key as an error, but bearer calls need none", async () => {
    await credentialsStore.clear();
    await expect(apiFetch('/v2/tagged', { auth: 'auto', schema: Anything })).rejects.toThrow(
      MissingCredentialsError,
    );
    setTokenProvider({
      getAccessToken: async () => 'token',
      refresh: async () => null,
      onAuthFailure: () => undefined,
    });
    const requests = captureTagged();
    await apiFetch('/v2/tagged', { auth: 'auto', schema: Anything });
    expect(requests[0]?.headers.get('authorization')).toBe('Bearer token');
    expect(buildUrl('/v2/user/info', {}, 'none')).not.toContain('api_key');
  });
});
