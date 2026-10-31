import { http, HttpResponse } from 'msw';

import blogPosts from '@/api/fixtures/blog.posts.npf.json';
import { API, MISSING_BLOG, server } from '@/test/msw';

import { setTokenProvider } from '../client';
import { NotFoundError } from '../errors';
import { isNpfPost } from '../schemas/post';

import { avatarUrl, getBlogInfo, getBlogPosts } from './blog';
import { getPost } from './posts';
import { getTagged } from './tagged';
import {
  follow,
  getDashboard,
  getFollowing,
  getLikes,
  getUserInfo,
  like,
  reblog,
  unfollow,
  unlike,
} from './user';

function record(method: 'get' | 'post', path: string) {
  const requests: Request[] = [];
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url);
    if (request.method === method.toUpperCase() && url.pathname === path)
      requests.push(request.clone());
  });
  return requests;
}

const signedIn = () =>
  setTokenProvider({
    getAccessToken: async () => 'token',
    refresh: async () => null,
    onAuthFailure: () => undefined,
  });

afterEach(() => {
  setTokenProvider(null);
  server.events.removeAllListeners();
});

describe('guest endpoints', () => {
  it('getTagged sends tag/before/limit/filter and parses legacy posts', async () => {
    const requests = record('get', '/v2/tagged');
    const posts = await getTagged({ tag: 'photography', before: 1761900000 });
    const url = new URL(requests[0]?.url ?? '');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      tag: 'photography',
      before: '1761900000',
      limit: '20',
      filter: 'text',
      api_key: 'test',
    });
    expect(posts.map((p) => p.type)).toEqual(['photo', 'photo', 'video', 'video', 'text', 'photo']);
  });

  it('getBlogInfo returns BlogInfo with adult flags and avatars', async () => {
    const blog = await getBlogInfo('northlight-studio');
    expect(blog).toMatchObject({
      name: 'northlight-studio',
      is_adult: false,
      is_nsfw: false,
      posts: 1843,
    });
    expect(blog.uuid).toMatch(/^t:/);
    expect(blog.avatar[0]?.width).toBe(512);
  });

  it('getBlogInfo → NotFoundError for missing blogs', async () => {
    await expect(getBlogInfo(MISSING_BLOG)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('getBlogPosts requests NPF and exposes _links.next', async () => {
    const requests = record('get', '/v2/blog/northlight-studio/posts');
    const page = await getBlogPosts({ name: 'northlight-studio', tag: 'iceland' });
    const params = new URL(requests[0]?.url ?? '').searchParams;
    expect(params.get('npf')).toBe('true');
    expect(params.get('tag')).toBe('iceland');
    expect(page.posts.every(isNpfPost)).toBe(true);
    expect(page._links?.next?.query_params?.before).toBeDefined();
  });

  it('avatarUrl builds the no-auth avatar URL', () => {
    expect(avatarUrl('staff')).toBe('https://api.tumblr.com/v2/blog/staff/avatar/128');
    expect(avatarUrl('staff', 64)).toBe('https://api.tumblr.com/v2/blog/staff/avatar/64');
  });

  it('getPost falls back to /posts?id= for guests', async () => {
    const requests = record('get', '/v2/blog/northlight-studio/posts');
    server.use(
      http.get(`${API}/v2/blog/:blog/posts`, () =>
        HttpResponse.json({
          ...blogPosts,
          response: { ...blogPosts.response, posts: [blogPosts.response.posts[1]] },
        }),
      ),
    );
    const post = await getPost('northlight-studio', '742388497658807856');
    expect(new URL(requests[0]?.url ?? '').searchParams.get('id')).toBe('742388497658807856');
    expect(post.id_string).toBe('742388497658807856');
  });

  it('getPost uses the single-post endpoint when signed in', async () => {
    signedIn();
    const post = await getPost('northlight-studio', '742388497658807856');
    expect(post.id_string).toBe('742388497658807856');
  });

  it('getPost → NotFoundError when the guest fallback is empty', async () => {
    server.use(
      http.get(`${API}/v2/blog/:blog/posts`, () =>
        HttpResponse.json({ meta: { status: 200, msg: 'OK' }, response: { posts: [] } }),
      ),
    );
    await expect(getPost('northlight-studio', '1')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('OAuth endpoints', () => {
  beforeEach(signedIn);

  it('getUserInfo', async () => {
    const user = await getUserInfo();
    expect(user.name).toBe('pixelwanderer');
    expect(user.blogs.find((b) => b.primary)?.name).toBe('pixelwanderer');
  });

  it('getDashboard drops malformed posts instead of failing the page', async () => {
    const page = await getDashboard({ offset: 20 });
    expect(page.posts).toHaveLength(4);
  });

  it('getLikes returns liked_posts and liked_count', async () => {
    const page = await getLikes({ before: 1761900000 });
    expect(page.liked_count).toBe(2381);
    expect(page.liked_posts.map((p) => p.liked_timestamp)).toEqual([
      expect.any(Number),
      expect.any(Number),
    ]);
  });

  it('getFollowing returns blogs and total', async () => {
    const page = await getFollowing({ offset: 0 });
    expect(page.total_blogs).toBe(214);
    expect(page.blogs).toHaveLength(5);
  });

  it.each([
    ['like', () => like({ id: '1', reblog_key: 'k' }), '/v2/user/like', 'id=1&reblog_key=k'],
    ['unlike', () => unlike({ id: '1', reblog_key: 'k' }), '/v2/user/unlike', 'id=1&reblog_key=k'],
    ['follow', () => follow('staff.tumblr.com'), '/v2/user/follow', 'url=staff.tumblr.com'],
    ['unfollow', () => unfollow('staff.tumblr.com'), '/v2/user/unfollow', 'url=staff.tumblr.com'],
  ])('%s posts a form body', async (_name, call, path, body) => {
    const requests = record('post', path);
    await call();
    expect(await requests[0]?.text()).toBe(body);
  });

  it('reblog posts an NPF JSON body', async () => {
    const requests = record('post', '/v2/blog/pixelwanderer/posts');
    const result = await reblog({
      blog: 'pixelwanderer',
      parentTumblelogUuid: 't:abc',
      parentPostId: '742388497658807856',
      reblogKey: 'k',
      comment: ' nice ',
      tags: ['a', 'b'],
    });
    expect(result.state).toBe('published');
    expect(JSON.parse((await requests[0]?.text()) ?? '{}')).toEqual({
      parent_tumblelog_uuid: 't:abc',
      parent_post_id: '742388497658807856',
      reblog_key: 'k',
      content: [{ type: 'text', text: 'nice' }],
      tags: 'a,b',
    });
  });
});
