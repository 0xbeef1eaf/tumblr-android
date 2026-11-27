# Tumblr API v2 — notes for this client

Source: https://github.com/tumblr/docs (api.md, npf-spec.md), checked 2026-10-31.

## Conventions
- Base `https://api.tumblr.com`. Envelope `{ meta: {status, msg}, response }`.
- Auth levels: **None** (avatar), **API key** (`?api_key=` consumer key, the user's own from
  Settings), **OAuth** (`Authorization: Bearer`). OAuth also satisfies API-key endpoints.
- `User-Agent` is required and must be consistent.
- IDs are 64-bit: always use `id_string`, never `id` as a JS number.
- Rate limits: 300/min & 18k/h per IP; **1000/h & 5000/day per consumer key**;
  1000 likes/day, 200 follows/day per user. 429 on breach.

## Endpoints used

| Use | Call | Auth |
|---|---|---|
| Tag gallery | `GET /v2/tagged?tag=&limit=20&before=&filter=text` | API key |
| Blog info | `GET /v2/blog/{name}/info` (`?fields[blogs]=...` optional) | API key |
| Blog avatar | `GET /v2/blog/{name}/avatar/128` → 301 to image; use URL directly in `<Image>` | None |
| Blog posts | `GET /v2/blog/{name}/posts?npf=true&limit=20&before=&tag=&reblog_info=true` | API key |
| Single post | `GET /v2/blog/{name}/posts/{id}?post_format=npf` | OAuth (guest fallback: `/posts?id=`) |
| User | `GET /v2/user/info` | OAuth |
| Dashboard | `GET /v2/user/dashboard?npf=true&limit=20&offset=&reblog_info=true` (`limit` max 20) | OAuth |
| For You | `GET /v2/tabs/for_you?limit=40&cursor=` → `{ timeline: { elements: Post[], _links.next } }` — **undocumented, used by official clients; may stop working** (403/404 → "not offered to third-party apps" state) | OAuth |
| Likes | `GET /v2/user/likes?limit=20&before=` → `liked_posts`, `liked_count` | OAuth |
| Following | `GET /v2/user/following?limit=20&offset=` → `blogs`, `total_blogs` | OAuth |
| Blog following | `GET /v2/blog/{name}/following?limit=20&offset=` → `blogs` (`name`, `title`, `description`, `url`, `uuid`, `updated`), `total_blogs`; the blog's public list, most recent first. Blogs that hide it answer 403 (treated as an empty list). Explore suggestions (DESIGN §3.1) | OAuth |
| Like / unlike | `POST /v2/user/like` / `unlike` body `{id, reblog_key}` | OAuth |
| Follow / unfollow | `POST /v2/user/follow` / `unfollow` body `{url}` | OAuth |
| Reblog | `POST /v2/blog/{myblog}/posts` body `{parent_tumblelog_uuid, parent_post_id, reblog_key, content?, tags?}` → 201 | OAuth |
| Notifications | `GET /v2/blog/{myblog}/notifications?before=&types[]=` → `notifications[]` (`id`, `type`, `timestamp`, `unread`, `from_tumblelog_*`, `target_post_id`, `target_tumblelog_name`, `target_media_url`, `added_text`, `reply_text`, …), `_links.next.query_params.before`; `myblog` must be the user's own (primary) blog; documented `types[]`: `like`, `reply`, `follow`, `mention_in_reply`, `mention_in_post`, `reblog_naked`, `reblog_with_content`, `ask`, `answered_ask`, `new_group_blog_member`, `post_attribution`, `post_flagged`, `post_appeal_accepted`, `post_appeal_rejected`, `what_you_missed`, `conversational_note`; unknown `type`s are kept and shown generically | OAuth |

Not available: full-text post search, following tags. Search is therefore tag
search plus direct blog lookup.

## OAuth2
- Authorize: `GET https://www.tumblr.com/oauth2/authorize?client_id&response_type=code&scope=basic%20write%20offline_access&state&redirect_uri`
- Token: `POST https://api.tumblr.com/v2/oauth2/token` form or JSON
  `{grant_type: 'authorization_code', code, client_id, client_secret, redirect_uri}`
  → `{access_token, expires_in (~2520 s), token_type: 'bearer', scope, refresh_token}`
- Refresh: same URL, `{grant_type: 'refresh_token', refresh_token, client_id, client_secret}`; 401 = refresh token dead.
- `client_secret` is required. The app uses the user's own Tumblr app: `client_id` is the
  consumer key and `client_secret` the consumer secret entered in Settings → Tumblr API, sent
  directly to the token URL above (exchange and refresh) in every build. A build-time
  secret is honoured only in dev builds; without any secret an optional proxy
  (`EXPO_PUBLIC_TOKEN_EXCHANGE_URL`) can add one (see ARCHITECTURE §7). No PKCE documented;
  still send `state`.
- `redirect_uri`: Tumblr's app registration only accepts http(s) callback URLs ("not a valid
  domain" for custom schemes). The app uses
  `https://0xbeef1eaf.github.io/tumblr-android/auth/callback` (`OAUTH_REDIRECT_URI`;
  forks: `EXPO_PUBLIC_OAUTH_REDIRECT_URI`) as a pure identifier: the authorize page runs in an
  in-app WebView that intercepts the redirect to it (query `code`, `state`, or `error`,
  `error_description`) before it loads, so nothing is served there. The same value is sent
  as `redirect_uri` in the code exchange and must equal the app's "Default callback URL".
- Tokens belong to the app that issued them: changing or removing the credentials signs out.

## Post shapes to handle

### NPF post (blog posts / dashboard with `npf=true`, single post)
```
{ type: 'blocks', id_string, blog_name, blog: { name, uuid, is_adult? }, reblog_key, post_url,
  timestamp, tags: [], summary, note_count, liked, can_like, can_reblog,
  content: Block[], layout: Layout[], trail: [{ blog, post: {id}, content, layout }] }
Block (image): { type:'image', media: [{url,type,width,height,has_original_dimensions}], alt_text?, caption?, colors?: {c0,c1}, poster? }
Block (video): { type:'video', provider:'tumblr'|'youtube'|..., media?: {url,type,width,height}, poster?: Media[], url?, embed_html?, duration? }
Layout rows: { type:'rows', display: [{ blocks: number[] }], truncate_after? }
```
### Legacy post (`/tagged`, and anything without `npf=true`)
```
photo: { type:'photo', photos: [{ caption, alt_sizes: [{url,width,height}], original_size: {url,width,height} }], caption (HTML), photoset_layout? }
video: { type:'video', video_url?, thumbnail_url, thumbnail_width, thumbnail_height, duration?, player: [{embed_code,width}] }
text/quote/link/chat/audio/answer: no gallery media (ignore unless body embeds <img>, which we do not parse)
```
Common legacy fields: `id_string`, `blog_name`, `blog: { name, uuid }`, `reblog_key`, `post_url`, `timestamp`, `tags`, `note_count`, `liked`, `summary`, `is_nsfw`/`is_adult`? (treat missing as false).

## Fixtures to record (hand-authored if no key is available)
`src/api/fixtures/`: `tagged.photography.json` (legacy photo + photoset + video + text),
`blog.posts.npf.json` (image, photoset w/ rows, native video, youtube video, reblog with
trail-only media, text-only), `blog.info.json`, `blog.following.json` (hand-built: new,
already-followed, own and nameless entries), `user.info.json`, `user.dashboard.json`,
`user.likes.json`, `user.following.json`, `tabs.for_you.json` (hand-built from the dashboard
posts plus a non-post `title` element), `blog.notifications.json` (hand-built: one of each
common type, an unknown type and an item without `id`), `oauth.token.json`, `error.429.json`, `error.404.json`.
