import blogInfo from '@/api/fixtures/blog.info.json';
import blogPosts from '@/api/fixtures/blog.posts.npf.json';
import error404 from '@/api/fixtures/error.404.json';
import tagged from '@/api/fixtures/tagged.photography.json';
import dashboard from '@/api/fixtures/user.dashboard.json';
import following from '@/api/fixtures/user.following.json';
import userInfo from '@/api/fixtures/user.info.json';
import likes from '@/api/fixtures/user.likes.json';

import {
  asImageBlock,
  asTextBlock,
  asVideoBlock,
  BlogInfoResponseSchema,
  BlogPostsResponseSchema,
  DashboardResponseSchema,
  EnvelopeSchema,
  FollowingResponseSchema,
  isNpfPost,
  LikesResponseSchema,
  PostListSchema,
  PostSchema,
  UserInfoResponseSchema,
} from './index';

describe('fixtures satisfy the schemas (contract tests)', () => {
  it.each([
    ['blog.info', BlogInfoResponseSchema, blogInfo],
    ['blog.posts.npf', BlogPostsResponseSchema, blogPosts],
    ['user.info', UserInfoResponseSchema, userInfo],
    ['user.dashboard', DashboardResponseSchema, dashboard],
    ['user.likes', LikesResponseSchema, likes],
    ['user.following', FollowingResponseSchema, following],
    ['tagged.photography', PostListSchema, tagged],
  ] as const)('%s', (_name, schema, fixture) => {
    const envelope = EnvelopeSchema.parse(fixture);
    expect(envelope.meta.status).toBe(200);
    expect(schema.safeParse(envelope.response).success).toBe(true);
  });

  it('parses error envelopes', () => {
    const envelope = EnvelopeSchema.parse(error404);
    expect(envelope.meta.status).toBe(404);
    expect(envelope.errors?.[0]?.title).toBe('Not Found');
  });
});

describe('PostSchema', () => {
  it('keeps unknown fields (passthrough)', () => {
    const raw = { ...tagged.response[0], brand_new_field: { nested: true } };
    const post = PostSchema.parse(raw) as Record<string, unknown>;
    expect(post.brand_new_field).toEqual({ nested: true });
  });

  it('distinguishes NPF and legacy posts', () => {
    expect(isNpfPost(PostSchema.parse(blogPosts.response.posts[0]))).toBe(true);
    expect(isNpfPost(PostSchema.parse(tagged.response[0]))).toBe(false);
  });

  it('treats a post with a content array as NPF even when type is legacy', () => {
    const raw = { ...blogPosts.response.posts[0], type: 'photo' };
    const post = PostSchema.parse(raw);
    expect(post.type).toBe('blocks');
    expect(isNpfPost(post) && post.original_type).toBe('photo');
  });

  it('tolerates wrong-typed optional fields and odd array members', () => {
    const raw = {
      ...tagged.response[0],
      note_count: 'lots',
      tags: ['ok', 3, null],
      liked: 'yes',
    };
    const post = PostSchema.parse(raw);
    expect(post.note_count).toBeUndefined();
    expect(post.tags).toEqual(['ok']);
    expect(post.liked).toBeUndefined();
  });

  it('accepts numeric-string widths and numeric ids', () => {
    const raw = { ...tagged.response[0], id_string: undefined, id: 12345 };
    expect(PostSchema.parse(raw).id_string).toBe('12345');
  });

  it('drops posts without identity from lists rather than failing the page', () => {
    const list = PostListSchema.parse([
      blogPosts.response.posts[0],
      { type: 'photo' },
      'junk',
      null,
    ]);
    expect(list).toHaveLength(1);
  });
});

describe('block helpers', () => {
  const content = PostSchema.parse(blogPosts.response.posts[1]);
  const blocks = isNpfPost(content) ? content.content : [];

  it('narrow known block types and reject others', () => {
    expect(blocks.map((b) => Boolean(asImageBlock(b)))).toEqual([
      true,
      true,
      true,
      true,
      false,
      false,
    ]);
    expect(blocks.map((b) => Boolean(asTextBlock(b)))).toEqual([
      false,
      false,
      false,
      false,
      true,
      true,
    ]);
    expect(blocks.some((b) => asVideoBlock(b))).toBe(false);
  });

  it('returns undefined for a malformed image block', () => {
    expect(asImageBlock({ type: 'image', media: 'nope' } as never)?.media).toEqual([]);
    expect(asImageBlock({ type: 'video' })).toBeUndefined();
  });
});
