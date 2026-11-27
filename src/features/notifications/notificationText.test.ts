import { NotificationSchema, type TumblrNotification } from '@/api/schemas/notifications';

import { describeNotification, notificationHref } from './notificationText';
import { relativeTime } from './relativeTime';

const make = (fields: Record<string, unknown>): TumblrNotification =>
  NotificationSchema.parse({ id: '1', timestamp: 1, from_tumblelog_name: 'alice', ...fields });

describe('describeNotification', () => {
  it.each([
    [{ type: 'like' }, { actor: 'alice', action: 'liked your post' }],
    [{ type: 'reblog_naked' }, { actor: 'alice', action: 'reblogged your post' }],
    [
      { type: 'reblog_with_content', added_text: '  so good ' },
      { actor: 'alice', action: 'reblogged your post', quote: 'so good' },
    ],
    [
      { type: 'reply', reply_text: 'hi!' },
      { actor: 'alice', action: 'replied:', quote: 'hi!' },
    ],
    [{ type: 'reply' }, { actor: 'alice', action: 'replied to your post' }],
    [{ type: 'follow' }, { actor: 'alice', action: 'started following you' }],
    [{ type: 'follower' }, { actor: 'alice', action: 'started following you' }],
    [{ type: 'ask' }, { actor: 'alice', action: 'sent you an ask' }],
    [
      { type: 'ask', is_anonymous: true },
      { actor: 'Anonymous', action: 'sent you an ask' },
    ],
    [{ type: 'answered_ask' }, { actor: 'alice', action: 'answered your ask' }],
    [{ type: 'note_mention' }, { actor: 'alice', action: 'mentioned you' }],
    [{ type: 'mention_in_reply' }, { actor: 'alice', action: 'mentioned you' }],
    [{ type: 'mention_in_post' }, { actor: 'alice', action: 'mentioned you' }],
    [{ type: 'post_attribution' }, { actor: 'alice', action: 'credited you in a post' }],
    [{ type: 'new_group_blog_member' }, { actor: 'alice', action: 'joined your group blog' }],
    [{ type: 'post_flagged' }, { actor: 'Tumblr', action: 'flagged your post' }],
    [{ type: 'post_appeal_accepted' }, { actor: 'Tumblr', action: 'accepted your appeal' }],
    [{ type: 'post_appeal_rejected' }, { actor: 'Tumblr', action: 'rejected your appeal' }],
    [{ type: 'what_you_missed' }, { actor: 'Tumblr', action: 'has posts you might have missed' }],
    [
      { type: 'conversational_note', target_post_id: '1' },
      { actor: 'alice', action: 'replied in a conversation on your post' },
    ],
    [{ type: 'conversational_note' }, { actor: 'alice', action: 'replied in a conversation' }],
    [
      { type: 'brand_new_thing', target_post_id: '1' },
      { actor: 'alice', action: 'interacted with your post' },
    ],
    [{ type: 'brand_new_thing' }, { actor: 'alice', action: 'has new activity for you' }],
    [
      { type: 'brand_new_thing', from_tumblelog_name: undefined },
      { actor: '', action: 'You have a new notification' },
    ],
    [
      { type: 'like', from_tumblelog_name: undefined },
      { actor: 'Someone', action: 'liked your post' },
    ],
  ])('%j', (fields, expected) => {
    expect(describeNotification(make(fields))).toEqual(expected);
  });
});

describe('notificationHref', () => {
  const post = { target_post_id: '742388497658807856', target_tumblelog_name: 'me' };
  it.each(['follow', 'follower'])('sends a %s to their blog', (type) => {
    expect(notificationHref(make({ type, ...post }))).toBe('/blog/alice');
  });
  it('sends post activity to the target post', () => {
    expect(notificationHref(make({ type: 'like', ...post }))).toBe('/post/me/742388497658807856');
  });
  it('falls back to the other blog, then to nothing', () => {
    expect(notificationHref(make({ type: 'ask' }))).toBe('/blog/alice');
    expect(notificationHref(make({ type: 'ask', is_anonymous: true }))).toBeUndefined();
  });
});

describe('relativeTime', () => {
  const now = Date.UTC(2026, 10, 27, 12);
  const sec = now / 1000;
  it.each([
    [sec - 10, 'now'],
    [sec - 5 * 60, '5m'],
    [sec - 3 * 3600, '3h'],
    [sec - 2 * 86400, '2d'],
    [sec - 15 * 86400, '2w'],
    [sec + 100, 'now'],
  ])('%d → %s', (ts, expected) => {
    expect(relativeTime(ts, now)).toBe(expected);
  });
  it('shows a date for older items', () => {
    expect(relativeTime(sec - 90 * 86400, now)).not.toMatch(/^\d+[mhdw]$/);
  });
});
