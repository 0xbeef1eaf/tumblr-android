import { apiFetch } from '../client';
import { NotificationsResponseSchema, type NotificationsPage } from '../schemas/notifications';

import { blogPath } from './blog';

export interface GetNotificationsParams {
  /** A blog the signed-in user owns (their primary blog). */
  blog: string;
  /** Unix seconds cursor from the previous page. */
  before?: number;
  /** Only these notification types (`types[]`); all types when empty. */
  types?: readonly string[];
  signal?: AbortSignal;
}

/** `types[]` repeats, which `apiFetch`'s query map cannot express, so it goes in the path. */
function typesQuery(types: readonly string[] | undefined): string {
  if (!types || types.length === 0) return '';
  return `?${types.map((type) => `types%5B%5D=${encodeURIComponent(type)}`).join('&')}`;
}

/** `GET /v2/blog/{blog}/notifications` (OAuth; the blog must belong to the user). */
export function getNotifications({
  blog,
  before,
  types,
  signal,
}: GetNotificationsParams): Promise<NotificationsPage> {
  return apiFetch(`${blogPath(blog)}/notifications${typesQuery(types)}`, {
    query: { before },
    auth: 'bearer',
    schema: NotificationsResponseSchema,
    signal,
  });
}
