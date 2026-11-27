import type { TumblrNotification } from '@/api/schemas/notifications';

/**
 * What a notification row says: `actor` in bold, then `action`, then an optional quote.
 * `actor` is empty when nobody is named; the row then shows `action` alone.
 */
export interface NotificationText {
  actor: string;
  action: string;
  quote?: string;
}

const MENTION_TYPES = new Set(['note_mention', 'mention_in_reply', 'mention_in_post']);
/** Tumblr documents `follow`; `follower` is accepted too. */
const FOLLOW_TYPES = new Set(['follow', 'follower']);

function actorName(n: TumblrNotification): string {
  if (n.is_anonymous) return 'Anonymous';
  return n.from_tumblelog_name || 'Someone';
}

function trimmed(text: string | undefined): string | undefined {
  const value = text?.trim();
  return value ? value : undefined;
}

/**
 * Sentence for a notification. Documented types (like, reply, follow, mention_in_reply,
 * mention_in_post, reblog_naked, reblog_with_content, ask, answered_ask, new_group_blog_member,
 * post_attribution, post_flagged, post_appeal_*, what_you_missed, conversational_note) get their
 * own wording. Unknown types depend on the data: "interacted with your post" when there is a
 * target post, "has new activity for you" when only the sender is known, otherwise
 * "You have a new notification" with no actor.
 */
export function describeNotification(n: TumblrNotification): NotificationText {
  const actor = actorName(n);
  if (FOLLOW_TYPES.has(n.type)) return { actor, action: 'started following you' };
  switch (n.type) {
    case 'like':
      return { actor, action: 'liked your post' };
    case 'reblog_naked':
      return { actor, action: 'reblogged your post' };
    case 'reblog_with_content':
      return { actor, action: 'reblogged your post', quote: trimmed(n.added_text) };
    case 'reply': {
      const quote = trimmed(n.reply_text);
      return { actor, action: quote ? 'replied:' : 'replied to your post', quote };
    }
    case 'ask':
      return { actor, action: 'sent you an ask' };
    case 'answered_ask':
      return { actor, action: 'answered your ask' };
    case 'post_attribution':
      return { actor, action: 'credited you in a post' };
    case 'new_group_blog_member':
      return { actor, action: 'joined your group blog' };
    case 'post_flagged':
      return { actor: 'Tumblr', action: 'flagged your post' };
    case 'post_appeal_accepted':
      return { actor: 'Tumblr', action: 'accepted your appeal' };
    case 'post_appeal_rejected':
      return { actor: 'Tumblr', action: 'rejected your appeal' };
    case 'what_you_missed':
      return { actor: 'Tumblr', action: 'has posts you might have missed' };
    case 'conversational_note':
      return {
        actor,
        action: n.target_post_id
          ? 'replied in a conversation on your post'
          : 'replied in a conversation',
      };
    default:
      if (MENTION_TYPES.has(n.type)) return { actor, action: 'mentioned you' };
      if (n.target_post_id) return { actor, action: 'interacted with your post' };
      if (fromBlog(n)) return { actor, action: 'has new activity for you' };
      return { actor: '', action: 'You have a new notification' };
  }
}

/** The blog behind a notification, unless it is anonymous. */
export function fromBlog(n: TumblrNotification): string | undefined {
  return n.is_anonymous ? undefined : n.from_tumblelog_name || undefined;
}

/**
 * Where tapping a row goes: a new follower → their blog; anything about a post → that post;
 * otherwise the other blog, if known.
 */
export function notificationHref(n: TumblrNotification): string | undefined {
  const from = fromBlog(n);
  if (FOLLOW_TYPES.has(n.type) && from) return blogHref(from);
  if (n.target_post_id && n.target_tumblelog_name) {
    return `/post/${encodeURIComponent(n.target_tumblelog_name)}/${encodeURIComponent(n.target_post_id)}`;
  }
  return from ? blogHref(from) : undefined;
}

export function blogHref(name: string): string {
  return `/blog/${encodeURIComponent(name)}`;
}
