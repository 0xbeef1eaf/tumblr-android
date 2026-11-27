import { z } from 'zod';

import { LinksSchema, type Links } from './envelope';
import { idString, lenientArray, looseNumber, opt } from './util';

/**
 * One activity item from `GET /v2/blog/{blog}/notifications`. Only `id`, `type` and
 * `timestamp` are required; `type` stays an open string so new kinds Tumblr adds never
 * reject a page (the screen falls back to a generic sentence).
 */
export const NotificationSchema = z.looseObject({
  id: idString,
  type: z.string().min(1),
  timestamp: looseNumber,
  unread: opt(z.boolean()),
  target_post_id: opt(idString),
  target_post_summary: opt(z.string()),
  target_tumblelog_name: opt(z.string()),
  target_tumblelog_uuid: opt(z.string()),
  target_post_type: opt(z.string()),
  /** Thumbnail of the signed-in user's post the notification is about. */
  target_media_url: opt(z.string()),
  from_tumblelog_name: opt(z.string()),
  from_tumblelog_uuid: opt(z.string()),
  from_tumblelog_avatar: opt(z.string()),
  from_tumblelog_is_adult: opt(z.boolean()),
  /** Whether the user follows `from_tumblelog_name`. */
  followed: opt(z.boolean()),
  /** The other blog's post (e.g. the reblog). */
  post_id: opt(idString),
  post_type: opt(z.string()),
  reply_text: opt(z.string()),
  added_text: opt(z.string()),
  media_url: opt(z.string()),
  post_tags: lenientArray(z.string()),
  privacy: opt(z.string()),
  is_anonymous: opt(z.boolean()),
});
export type TumblrNotification = z.infer<typeof NotificationSchema>;

/** `before` of the next page: `query_params.before`, else `before=` in `href`. */
export function notificationsCursor(links: Links | undefined): number | undefined {
  const next = links?.next;
  if (!next) return undefined;
  const param = looseNumber.safeParse(next.query_params?.before);
  if (param.success) return param.data;
  const match = /[?&]before=(\d+)/.exec(next.href);
  return match?.[1] ? Number(match[1]) : undefined;
}

export interface NotificationsPage {
  notifications: TumblrNotification[];
  /** Unix seconds cursor for the next (older) page; absent on the last page. */
  nextBefore?: number;
}

/** Response of `GET /v2/blog/{blog}/notifications`; malformed items are dropped. */
export const NotificationsResponseSchema = z
  .looseObject({
    notifications: lenientArray(NotificationSchema),
    _links: opt(LinksSchema),
  })
  .transform(({ notifications, _links }): NotificationsPage => ({
    notifications,
    nextBefore: notificationsCursor(_links),
  }));
