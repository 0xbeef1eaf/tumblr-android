import { avatarUrl } from '@/api/endpoints/blog';
import type { UserInfo } from '@/api/schemas/user';

import type { SessionUser } from './authStore';

/** `/user/info` → the small, non-secret profile kept in the auth store. */
export function toSessionUser(info: UserInfo): SessionUser {
  const blog = info.blogs.find((b) => b.primary) ?? info.blogs[0];
  const primaryBlog = blog?.name;
  return {
    name: info.name,
    primaryBlog,
    primaryBlogUuid: blog?.uuid,
    avatarUrl: primaryBlog ? avatarUrl(primaryBlog, 128) : undefined,
  };
}
