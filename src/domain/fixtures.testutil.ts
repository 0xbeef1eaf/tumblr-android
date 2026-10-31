import blogPosts from '@/api/fixtures/blog.posts.npf.json';
import dashboard from '@/api/fixtures/user.dashboard.json';
import likes from '@/api/fixtures/user.likes.json';
import tagged from '@/api/fixtures/tagged.photography.json';
import { PostListSchema, type Post } from '@/api/schemas/post';

function byIndex(list: Post[], index: number): Post {
  const post = list[index];
  if (!post) throw new Error(`fixture post ${index} missing`);
  return post;
}

const npf = PostListSchema.parse(blogPosts.response.posts);
const legacy = PostListSchema.parse(tagged.response);
const dash = PostListSchema.parse(dashboard.response.posts);
const liked = PostListSchema.parse(likes.response.liked_posts);

/** Named fixture posts so tests read like the spec. */
export const fx = {
  npfSingleImage: byIndex(npf, 0),
  npfPhotosetRows: byIndex(npf, 1),
  npfNativeVideo: byIndex(npf, 2),
  npfYoutube: byIndex(npf, 3),
  npfReblogTrailOnly: byIndex(npf, 4),
  npfTextOnly: byIndex(npf, 5),
  legacyPhoto: byIndex(legacy, 0),
  legacyPhotoset: byIndex(legacy, 1),
  legacyVideo: byIndex(legacy, 2),
  legacyYoutube: byIndex(legacy, 3),
  legacyText: byIndex(legacy, 4),
  legacyFeatured: byIndex(legacy, 5),
  npfGif: byIndex(dash, 0),
  npfAdultBlog: byIndex(dash, 1),
  npfCommunityLabel: byIndex(dash, 2),
  likedNpf: byIndex(liked, 0),
  likedLegacy: byIndex(liked, 1),
  raw: { blogPosts, tagged, dashboard, likes },
  lists: { npf, legacy, dash, liked },
};
