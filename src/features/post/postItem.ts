import { asImageBlock, asVideoBlock, type NpfBlock } from '@/api/schemas/npf';
import { isNpfPost, type Post } from '@/api/schemas/post';
import { isSensitivePost, normalizePost, type GalleryItem } from '@/domain/galleryItem';
import { npfTextToPlain } from '@/domain/text';

/**
 * A `GalleryItem` standing for the whole post, for like/reblog/bookmark actions. Uses the
 * first media item when the post has any; text-only posts get a media-less stand-in.
 */
export function postToItem(post: Post): GalleryItem {
  const [first] = normalizePost(post);
  if (first) return first;
  return {
    id: `${post.id_string}:0`,
    postId: post.id_string,
    blogName: post.blog_name,
    blogUuid: post.blog?.uuid,
    reblogKey: post.reblog_key,
    postUrl: post.post_url,
    timestamp: post.timestamp,
    kind: 'image',
    variants: [],
    aspectRatio: 1,
    tags: post.tags,
    summary: isNpfPost(post) ? npfTextToPlain(post.content) : (post.summary ?? ''),
    noteCount: post.note_count,
    liked: post.liked,
    isSensitive: isSensitivePost(post),
    indexInPost: 0,
    countInPost: 0,
  };
}

/** Index of the gallery item produced from an NPF image/video block (matched by URL), or -1. */
export function itemIndexForBlock(items: readonly GalleryItem[], block: NpfBlock): number {
  const image = asImageBlock(block);
  const video = asVideoBlock(block);
  const media = video ? (Array.isArray(video.media) ? video.media : [video.media]) : [];
  const urls = new Set<string>([
    ...(image?.media ?? []).map((m) => m.url),
    ...(video?.poster ?? []).map((m) => m.url),
    ...media.flatMap((m) => (m ? [m.url] : [])),
  ]);
  return items.findIndex(
    (item) =>
      item.variants.some((variant) => urls.has(variant.url)) ||
      (item.videoUrl !== undefined && urls.has(item.videoUrl)),
  );
}
