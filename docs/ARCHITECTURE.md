# Tumblr Gallery — Technical Architecture

## 1. Stack (pinned by `npx expo install`, versions as of 2026-10)

| Concern | Choice | Why |
|---|---|---|
| Runtime | Expo SDK 58, React Native 0.88, React 19, TypeScript strict | Managed workflow + CNG; EAS builds; no local Android SDK required to develop |
| Routing | `expo-router` v58 | File-based, typed routes, deep links (`tumblrgallery://blog/x`) |
| Server state | `@tanstack/react-query` v5 + `@tanstack/query-async-storage-persister` | Infinite queries, cache persistence, retry/backoff |
| Client state | `zustand` v5 (persist middleware → MMKV) | Auth session, settings, search history, viewer handoff |
| Storage | `react-native-mmkv` (fast KV), `expo-secure-store` (tokens) | Tokens never land in plain storage |
| Images | `expo-image` | Disk+memory cache, placeholders, GIF, blurRadius, recyclingKey |
| Video | `expo-video` | Native player, muted autoplay |
| Lists | `@shopify/flash-list` v2 (`masonry` prop) | Recycling masonry grid |
| Gestures/anim | `react-native-gesture-handler` v3, `react-native-reanimated` v4 | Pinch-zoom viewer, swipe-to-dismiss |
| Auth | `expo-auth-session` + `expo-web-browser` | OAuth2 authorization-code flow |
| Validation | `zod` v4 | Parse API responses at the boundary; fixtures double as contract tests |
| Tests | `jest-expo`, `@testing-library/react-native`, `msw` v2 | Unit + component tests against recorded fixtures |
| Lint | `eslint-config-expo`, `prettier` | |
| CI | GitHub Actions: typecheck, lint, test, `expo export` | No device needed |
| Builds | EAS (`eas.json`: development, preview APK, production AAB) | |

## 2. Repository layout

```
app/                         expo-router routes (thin: compose feature screens)
  _layout.tsx                providers: QueryClient, GestureHandlerRoot, Theme, Auth bootstrap
  (tabs)/_layout.tsx         tab bar; hides Dashboard when signed out
  (tabs)/index.tsx           Explore
  (tabs)/dashboard.tsx
  (tabs)/search.tsx
  (tabs)/likes.tsx
  (tabs)/settings.tsx
  tag/[tag].tsx
  blog/[name].tsx
  post/[blog]/[id].tsx
  viewer.tsx                 presentation: 'transparentModal'
  auth/callback.tsx          OAuth redirect target (also handled by expo-auth-session)
src/
  api/
    client.ts                fetch wrapper: base URL, User-Agent, api_key/Bearer, 429 backoff, zod parse
    auth.ts                  OAuth2: authorize, exchange, refresh, token store (SecureStore)
    endpoints/               one file per resource: tagged.ts, blog.ts, user.ts, posts.ts
    schemas/                 zod schemas: npf.ts, legacy.ts, blog.ts, user.ts, envelope.ts
    fixtures/                recorded JSON used by msw handlers and tests
  domain/
    galleryItem.ts           GalleryItem type + normalizePost(): NPF|legacy → GalleryItem[]
    media.ts                 pickVariant(), aspect clamp, kind detection (image/gif/video)
    text.ts                  NPF text → plain/attributed, legacy HTML → text
  features/
    gallery/                 MasonryGallery, GalleryTile, Skeleton, useGalleryPaging, viewerStore
    viewer/                  ViewerScreen, ZoomableImage, VideoPage, ViewerChrome
    search/                  SearchBar, Suggestions, useSearchHistory, FilterRow
    blog/                    BlogHeader, useBlogInfo, useBlogPosts, useFollow
    tag/                     useTaggedPosts
    post/                    PostDetail, NpfRenderer, useLike, useReblog
    auth/                    useSession, SignInButton, authStore
    settings/                settingsStore, SettingsScreen
    explore/                 StarterTags, RecentChips, FollowingRow
  ui/
    theme.ts                 tokens; useTheme(); light/dark
    primitives/              Text, Pressable, Chip, Sheet, Toast, Icon (lucide-react-native or @expo/vector-icons)
  lib/
    queryClient.ts           QueryClient + persister
    storage.ts               MMKV instance + zustand storage adapter
    env.ts                   EXPO_PUBLIC_* read + validation
    log.ts
docs/
```

Rules:
- `app/` files import from `src/features/*` only; no API calls in routes.
- `src/features/*` import `src/api`, `src/domain`, `src/ui`, `src/lib`; never each other
  except through explicitly exported hooks (keep a dependency-cruiser-friendly tree).
- `src/api` knows nothing about React.

## 3. Data flow

```
Tumblr API ──fetch──▶ api/client (auth, retry, zod) ──▶ endpoints/*.ts (typed fns)
      ▲                                                        │
      │                                                        ▼
  react-query mutations                             domain/normalizePost → GalleryItem[]
  (like, follow, reblog)                                      │
                                                              ▼
                                      useInfiniteQuery(select: flatten → dedupe by item.id)
                                                              │
                                                              ▼
                                       MasonryGallery (FlashList) ──tap──▶ viewerStore.open(items, i)
                                                                               │
                                                                               ▼
                                                                        router.push('/viewer')
```

- Query keys: `['tagged', tag]`, `['blog', name, 'posts', {tag}]`, `['blog', name, 'info']`,
  `['dashboard']`, `['likes']`, `['user']`, `['following']`, `['post', blog, id]`.
- `staleTime` 5 min for galleries, 1 h for blog info/avatars; cache persisted to MMKV
  with `maxAge` 24 h (gallery pages only; never auth).
- Mutations are optimistic (like toggles instantly, rolls back on error) and
  invalidate `['likes']`.

## 4. Pagination strategy per source

| Source | Endpoint | Cursor | Notes |
|---|---|---|---|
| Tag | `GET /v2/tagged?tag=&limit=20&before=` | `before` = `timestamp` of last post (featured tags: `featured_timestamp`) | Legacy format only; `filter=text` to drop HTML |
| Blog posts | `GET /v2/blog/{name}/posts?npf=true&limit=20&before=` (+`tag=`) | `before` = last post `timestamp` | Use `_links.next.query_params` when present |
| Dashboard | `GET /v2/user/dashboard?npf=true&limit=20&offset=` | `offset` | `reblog_info=true` for trail attribution |
| Likes | `GET /v2/user/likes?limit=20&before=` | `before` = `liked_timestamp` | `offset` max 1000, so prefer `before` |
| Following | `GET /v2/user/following?limit=20&offset=` | `offset` | |

Stop condition: page returned < limit or cursor unchanged. Dedupe by item id
across pages (Tumblr pages can overlap).

## 5. Domain model

### 5.1 GalleryItem
```ts
type MediaKind = 'image' | 'gif' | 'video';
interface MediaVariant { url: string; width: number; height: number; type?: string }
interface GalleryItem {
  id: string;               // `${postId}:${blockIndex}` — one post may yield many items
  postId: string;           // id_string
  blogName: string;
  blogUuid?: string;
  reblogKey: string;
  postUrl: string;
  timestamp: number;        // unix seconds
  kind: MediaKind;
  variants: MediaVariant[]; // sorted widest → narrowest; for video this is the poster
  videoUrl?: string;        // native tumblr video only; embeds fall back to postUrl
  durationMs?: number;
  aspectRatio: number;      // width/height of the original, unclamped
  altText?: string;
  placeholderColor?: string;// NPF colors.c0 → '#rrggbb'
  tags: string[];
  summary: string;          // first text block / legacy caption, plain text, ≤ 280 chars
  noteCount?: number;
  liked?: boolean;
  isSensitive: boolean;     // post.is_nsfw || blog.is_adult || post flagged
  indexInPost: number; countInPost: number;
}
```

### 5.2 normalizePost(post): GalleryItem[]
- NPF (`type === 'blocks'` or `content` present): walk `content` **and every
  `trail[i].content`** (reblogs of photosets have media only in the trail);
  emit an item per `image` block and per `video` block with `provider === 'tumblr'`
  (other providers emit an image item from `poster` with `videoUrl` undefined).
  GIF detection: any variant `type === 'image/gif'` or url ends in `.gif`.
- Legacy `photo` posts: `photos[]` → each has `original_size` + `alt_sizes`;
  GIF by extension. Legacy `video` with `video_url`: one item, poster from
  `thumbnail_url`. Other legacy types: no items.
- Posts with zero items are dropped from galleries (text posts).
- Never throw on unexpected shapes: zod schemas use `.passthrough()` and
  optional fields; a malformed post logs and yields `[]`.

### 5.3 pickVariant(variants, targetWidthPx)
Return the narrowest variant whose `width >= targetWidthPx`; if none, the widest.
Grid target = `columnWidthDp * PixelRatio.get()`; viewer target = screen width px.
Tumblr serves 75/100/250/400/500/540/640/1280/2048 widths; GIFs should prefer
≤ 540 in the grid for bandwidth.

## 6. Networking details

- Base `https://api.tumblr.com`; constant `User-Agent: TumblrGallery/<version> (Android)`
  — Tumblr requires a consistent UA.
- Guest requests append `api_key=<EXPO_PUBLIC_TUMBLR_API_KEY>`; authed requests
  send `Authorization: Bearer <token>` and omit `api_key`.
- Envelope: `{ meta: { status, msg }, response, errors? }` — parse `meta.status`
  before `response`.
- Errors: `ApiError { status, code?, detail?, retryAfterSec? }`. 429 → exponential
  backoff (1s, 2s, 4s, max 3 retries) honouring `Retry-After`; 401 on authed
  call → attempt one token refresh then sign out; 404 → typed `NotFound`.
- Budget: the consumer key allows 1000 calls/h. Explore preview strips are
  limited to 10 tags × 1 call, cached 1 h.

## 7. Authentication

Tumblr's OAuth2 token endpoint requires `client_secret` and the docs do not
mention PKCE, so a pure mobile app cannot complete the exchange without
exposing the secret. Design:

1. **Guest mode** (default): API-key-only; all public galleries work.
2. **Sign in**: `expo-auth-session` opens
   `https://www.tumblr.com/oauth2/authorize?client_id&response_type=code&scope=basic write offline_access&state&redirect_uri`.
   Redirect URI: `tumblrgallery://auth/callback` (registered in the Tumblr app).
3. **Token exchange** is done by `src/api/auth.ts` against
   `EXPO_PUBLIC_TOKEN_EXCHANGE_URL` — a tiny stateless proxy (reference
   implementation as a Cloudflare Worker in `proxy/`) that adds `client_secret`
   and forwards to `https://api.tumblr.com/v2/oauth2/token`. If the variable is
   unset **and** `EXPO_PUBLIC_TUMBLR_CLIENT_SECRET` is set (dev builds only),
   the app calls Tumblr directly. Production builds assert the proxy is set.
4. Tokens (`access_token`, `refresh_token`, `expires_at`) go in SecureStore.
   `client.ts` refreshes proactively when < 60 s remain and serialises
   concurrent refreshes with a single in-flight promise.
5. `useSession()` exposes `{ status: 'guest'|'signedIn'|'loading', user, signIn, signOut }`.

## 8. Performance budget

- Grid tile first paint ≤ 16 ms (no measurement; aspect ratio from data).
- Images: `expo-image` `cachePolicy="memory-disk"`, `recyclingKey=item.id`,
  `transition={200}`, `placeholder={{ backgroundColor }}`; grid variants ≤ 640 px.
- FlashList `estimatedItemSize` from median aspect; `drawDistance` 2 screens.
- GIFs: at most 6 animating on screen; off-screen tiles get `autoplay={false}`.
- Viewer prefetches ±1 page with `Image.prefetch`.
- Avoid re-renders: tiles memoised on `item.id` + `columnWidth` + `safeMode`.

## 9. Testing strategy

- `src/domain/*`: table-driven unit tests over fixtures (NPF photoset, NPF reblog
  with trail-only media, legacy photo, legacy video, text post → []).
- `src/api/client`: msw handlers for 200/401→refresh/429→retry/404; envelope parsing.
- Hooks: `renderHook` with a test QueryClient and msw.
- Components: `MasonryGallery` renders N tiles and opens the viewer store;
  `SearchBar` debounce and suggestions; `SettingsScreen` toggles persist.
- No live API calls in tests. CI sets dummy `EXPO_PUBLIC_TUMBLR_API_KEY=test`.
- Smoke: `npx expo export --platform android` must succeed (Metro bundles the app).

## 10. Configuration & secrets

`.env.example`:
```
EXPO_PUBLIC_TUMBLR_API_KEY=        # OAuth consumer key (public by design)
EXPO_PUBLIC_TOKEN_EXCHANGE_URL=    # https://<worker>.workers.dev/token
EXPO_PUBLIC_TUMBLR_CLIENT_SECRET=  # dev only; never set in EAS production profile
```
`app.config.ts` reads these; `scheme: 'tumblrgallery'`; Android package
`com.tumblrgallery.app`; `android.blockedPermissions` keeps the manifest minimal
(`WRITE_EXTERNAL_STORAGE` not needed on API 29+; saving uses `expo-media-library`
scoped access).

## 11. Delivery phases

- **P0 Foundation**: scaffold, theme, nav shell, client, schemas, normalizer, tests, CI.
- **P1 Gallery + Search** (guest usable): tag/blog galleries, search, viewer, explore.
- **P2 Account**: OAuth2, dashboard, likes, follow, like/reblog, post detail actions.
- **P3 Polish**: settings, safe mode, cache controls, saving media, haptics, README, EAS.
