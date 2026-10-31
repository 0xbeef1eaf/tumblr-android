import { normalizePost } from '@/domain/galleryItem';

import { FIXTURE_IDS, fixtureNpfPost, fixturePost } from './post.testutil';
import { itemIndexForBlock, postToItem } from './postItem';

describe('postToItem', () => {
  it('uses the first media item of a media post', () => {
    const post = fixturePost(FIXTURE_IDS.rows);
    expect(postToItem(post)).toEqual(normalizePost(post)[0]);
  });

  it('builds a media-less stand-in for text-only posts', () => {
    const item = postToItem(fixturePost(FIXTURE_IDS.textOnly));
    expect(item).toMatchObject({
      id: `${FIXTURE_IDS.textOnly}:0`,
      postId: FIXTURE_IDS.textOnly,
      blogName: 'northlight-studio',
      variants: [],
      countInPost: 0,
    });
    expect(item.reblogKey).toBeTruthy();
    expect(item.summary).not.toBe('');
  });
});

describe('itemIndexForBlock', () => {
  it('maps image and video blocks back to their gallery item', () => {
    const post = fixtureNpfPost(FIXTURE_IDS.rows);
    const items = normalizePost(post);
    expect(itemIndexForBlock(items, post.content[2] as never)).toBe(2);
    const video = fixtureNpfPost(FIXTURE_IDS.nativeVideo);
    expect(itemIndexForBlock(normalizePost(video), video.content[0] as never)).toBe(0);
  });

  it('returns -1 for text blocks and unknown media', () => {
    const post = fixtureNpfPost(FIXTURE_IDS.rows);
    const items = normalizePost(post);
    expect(itemIndexForBlock(items, post.content[4] as never)).toBe(-1);
    expect(itemIndexForBlock([], post.content[0] as never)).toBe(-1);
  });
});
