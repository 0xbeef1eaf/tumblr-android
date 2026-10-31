import { http, HttpResponse, type HttpHandler, type JsonBodyType } from 'msw';

import blogInfo from '@/api/fixtures/blog.info.json';
import blogPosts from '@/api/fixtures/blog.posts.npf.json';
import error404 from '@/api/fixtures/error.404.json';
import error429 from '@/api/fixtures/error.429.json';
import oauthToken from '@/api/fixtures/oauth.token.json';
import tagged from '@/api/fixtures/tagged.photography.json';
import dashboard from '@/api/fixtures/user.dashboard.json';
import following from '@/api/fixtures/user.following.json';
import userInfo from '@/api/fixtures/user.info.json';
import likes from '@/api/fixtures/user.likes.json';

// msw/node's exports map sets `"react-native": null`, which Expo's tsconfig resolution
// condition selects, so TS cannot see it. Jest resolves it fine; only the types need a path.
type MswNode = typeof import('../../node_modules/msw/lib/node/index.mjs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { setupServer } = require('msw/node') as MswNode;

export const API = 'https://api.tumblr.com';
export const fixtures = {
  blogInfo,
  blogPosts,
  error404,
  error429,
  oauthToken,
  tagged,
  dashboard,
  following,
  userInfo,
  likes,
} as const;

const ok = (body: JsonBodyType) => HttpResponse.json(body);
const created = (response: JsonBodyType) =>
  HttpResponse.json({ meta: { status: 201, msg: 'Created' }, response }, { status: 201 });
const empty = () => HttpResponse.json({ meta: { status: 200, msg: 'OK' }, response: [] });

/** A blog name that always 404s, for "blog not found" flows. */
export const MISSING_BLOG = 'this-blog-does-not-exist';

/** Default handlers: every endpoint the app calls, served from fixtures. */
export const handlers: HttpHandler[] = [
  http.get(`${API}/v2/tagged`, () => ok(tagged)),
  http.get(`${API}/v2/blog/:blog/info`, ({ params }) =>
    params.blog === MISSING_BLOG ? notFound() : ok(blogInfo),
  ),
  http.get(`${API}/v2/blog/:blog/posts`, ({ params }) =>
    params.blog === MISSING_BLOG ? notFound() : ok(blogPosts),
  ),
  http.get(`${API}/v2/blog/:blog/posts/:id`, ({ params }) => {
    const post = blogPosts.response.posts.find((p) => p.id_string === params.id);
    return post ? ok({ meta: { status: 200, msg: 'OK' }, response: post }) : notFound();
  }),
  http.post(`${API}/v2/blog/:blog/posts`, () =>
    created({ id: 1, id_string: '742390000000000001', state: 'published', display_text: 'Posted' }),
  ),
  http.get(`${API}/v2/user/info`, () => ok(userInfo)),
  http.get(`${API}/v2/user/dashboard`, () => ok(dashboard)),
  http.get(`${API}/v2/user/likes`, () => ok(likes)),
  http.get(`${API}/v2/user/following`, () => ok(following)),
  http.post(`${API}/v2/user/like`, empty),
  http.post(`${API}/v2/user/unlike`, empty),
  http.post(`${API}/v2/user/follow`, empty),
  http.post(`${API}/v2/user/unfollow`, empty),
  http.post(`${API}/v2/oauth2/token`, () => HttpResponse.json(oauthToken)),
];

export function notFound() {
  return HttpResponse.json(error404, { status: 404 });
}

export function rateLimited(retryAfterSec?: number) {
  return HttpResponse.json(error429, {
    status: 429,
    headers: retryAfterSec !== undefined ? { 'Retry-After': String(retryAfterSec) } : {},
  });
}

/** Handlers to `server.use(...)` in individual tests. */
export const errorHandlers = {
  rateLimitedAlways: (path: string, retryAfterSec?: number) =>
    http.all(`${API}${path}`, () => rateLimited(retryAfterSec)),
  notFound: (path: string) => http.all(`${API}${path}`, () => notFound()),
};

export const server = setupServer(...handlers);
