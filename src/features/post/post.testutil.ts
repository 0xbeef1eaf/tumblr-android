import blogPosts from '@/api/fixtures/blog.posts.npf.json';
import { PostSchema, type NpfPost, type Post } from '@/api/schemas/post';

/** Post ids in `blog.posts.npf.json`. */
export const FIXTURE_IDS = {
  singleImage: '742388590542579923',
  rows: '742388497658807856',
  nativeVideo: '742388397788945430',
  embedVideo: '742388357826616901',
  trailOnly: '742388278855295088',
  textOnly: '742388267902691995',
} as const;

export function fixturePost(id: string): Post {
  const raw = blogPosts.response.posts.find((p) => p.id_string === id);
  if (!raw) throw new Error(`No fixture post ${id}`);
  return PostSchema.parse(raw);
}

export function fixtureNpfPost(id: string): NpfPost {
  const post = fixturePost(id);
  if (post.type !== 'blocks') throw new Error('Not an NPF post');
  return post as NpfPost;
}
