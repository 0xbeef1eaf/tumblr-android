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
| Auth | `react-native-webview` (in-app sign-in page) | OAuth2 authorization-code flow; the https callback is intercepted in the WebView (§7) |
| Network state | `expo-network` | Offline banner, react-query `onlineManager`, "Autoplay GIFs on cellular" |
| Validation | `zod` v4 | Parse API responses at the boundary; fixtures double as contract tests |
| Tests | `jest-expo`, `@testing-library/react-native`, `msw` v2 | Unit + component tests against recorded fixtures |
| Lint | `eslint-config-expo`, `prettier` | |
| CI | GitHub Actions: typecheck, lint, test, `expo export`; `build-android.yml`: prebuild + Gradle release APK (debug-signed), GitHub Release on `v*` tags | No device needed |
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
  auth/sign-in.tsx           presentation: 'modal'; Tumblr's authorize page in a WebView (§7)
src/
  api/
    client.ts                fetch wrapper: base URL, User-Agent, api_key/Bearer, 429 backoff, zod parse
    auth.ts                  OAuth2: exchange, refresh, callback validation, token store (SecureStore)
    authorize.ts             authorize URL, scopes, OAUTH_REDIRECT_URI (https callback identifier)
    credentials.ts           user's own consumer key/secret (SecureStore) + env fallback resolution
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
    auth/                    useSession, SignInButton, authStore, oauth (authorize), oauthFlowStore, SignInScreen/SignInWebView
    credentials/             useCredentialsStore, useCredentialsBootstrap, useApiKeyStatus, ConnectAppCard
    settings/                settingsStore, SettingsScreen, TumblrApiSection, CredentialsSheet
    explore/                 StarterTags, RecentChips, FollowingRow
  ui/
    theme.ts                 tokens; useTheme(); light/dark
    OfflineBanner.tsx        DESIGN §7 offline banner (root layout, above the Stack)
    primitives/              Text, Pressable, Chip, Sheet, Toast, Icon (lucide-react-native or @expo/vector-icons)
  lib/
    queryClient.ts           QueryClient + persister + useSyncOnlineManager (expo-network → onlineManager)
    network.ts               useNetworkState(): { isConnected, isCellular, isLoading } over expo-network
    storage.ts               MMKV instance + zustand storage adapter
    env.ts                   optional EXPO_PUBLIC_* fallbacks: read + validation
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
  `['dashboard']`, `['forYou']`, `['likes']`, `['user']`, `['following']`, `['post', blog, id]`.
  Persisted roots: `tagged`, `blog`, `dashboard`, `forYou`, `likes`; dropped on sign-out:
  `dashboard`, `forYou`, `likes`, `user`, `following`.
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
| For You | `GET /v2/tabs/for_you?limit=20&cursor=` (undocumented) | opaque `cursor` from `_links.next.query_params.cursor`, else parsed from `href` | Elements filtered to `object_type: 'post'`; 403/404 → friendly "not offered" state |
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
- Guest requests append `api_key=<consumer key>`, read per request from the effective
  credentials (§7: Settings first, then `EXPO_PUBLIC_TUMBLR_API_KEY`). With no key at all,
  `apiFetch` throws `MissingCredentialsError` before any network call (never retried), and
  screens gate their queries on `useApiKeyStatus()` instead. Authed requests send
  `Authorization: Bearer <token>` and omit `api_key`.
- Envelope: `{ meta: { status, msg }, response, errors? }` — parse `meta.status`
  before `response`.
- Errors: `ApiError { status, code?, detail?, retryAfterSec? }`. 429 → exponential
  backoff (1s, 2s, 4s, max 3 retries) honouring `Retry-After`; 401 on authed
  call → attempt one token refresh then sign out; 404 → typed `NotFound`.
- Budget: the consumer key allows 1000 calls/h. Explore preview strips are
  limited to 10 tags × 1 call, cached 1 h.

## 7. Authentication

**Bring your own credentials.** Tumblr's OAuth2 token endpoint requires `client_secret` and
documents no PKCE, so the app does not ship a secret at all: each user registers their own
Tumblr app and enters its **consumer key** and **consumer secret** in Settings → Tumblr API.
The secret is theirs, on their own device, so the direct exchange is fine in every build.

1. **Credentials store** (`src/api/credentials.ts`, React-free): `TumblrCredentials
   { consumerKey; consumerSecret? }`, trimmed, saved as one JSON value under
   `tumblr.credentials` in SecureStore (memory under jest). `load()` once, then synchronous
   `get()`. `features/credentials` mirrors it into a zustand store (`status`,
   `credentials`, `source: 'user'|'env'|'none'`, `hasApiKey`, `setCredentials`,
   `clearCredentials`); `useCredentialsBootstrap()` runs in `AuthProvider`, and the session
   bootstrap waits for it because refreshing a stored token needs the secret.
2. **Effective credentials** (`getEffectiveCredentials()`): the user-entered pair if any
   (never mixed with a baked-in secret), else `EXPO_PUBLIC_TUMBLR_API_KEY` /
   `EXPO_PUBLIC_TUMBLR_CLIENT_SECRET`, else none. `hasApiKey()` says whether guest
   requests are possible.
3. **Guest mode** (default): API-key-only; all public galleries work. Without a key, Explore,
   Search, Tag and Blog show the "Connect your Tumblr app" card (DESIGN §3.1).
4. **Sign in** (in-app WebView): `sessionController.signIn()` first calls
   `assertSignInConfigured()`; a missing key/secret toasts the reason with a "Settings"
   action, without opening the sign-in screen. Then `authorize()` (`features/auth/oauth.ts`)
   generates a 128-bit `state`, builds
   `https://www.tumblr.com/oauth2/authorize?client_id=<consumer key>&response_type=code&scope=basic write offline_access&state&redirect_uri`
   (`buildAuthorizeUrl`, no PKCE: Tumblr documents none), publishes `{ url, state,
   redirectUri }` to the zustand `useOAuthFlowStore` and pushes `/auth/sign-in` (a modal
   route; `SignInScreen` → `SignInWebView`). The WebView loads the authorize URL with
   persistent cookies (`incognito={false}`, `sharedCookiesEnabled`), so a Tumblr login is
   remembered. `onShouldStartLoadWithRequest` returns `false` for the callback URL (and
   `onLoadStart` catches it as a fallback), so it never loads; its `code`, `state`,
   `error`, `error_description` query params settle the `authorize()` promise:
   `{ status: 'success', code, redirectUri }`, or `OAuthError` (`state_mismatch` when
   `state` differs, `access_denied` → "Sign-in was cancelled", `provider_error`,
   `missing_code`). Cancel, the back gesture or any unmount resolve `{ status:
   'cancelled' }`; the store settles each flow once, so the dismissal after a success is a
   no-op. Load and HTTP errors show a message with Retry.
   **Callback URL** (`OAUTH_REDIRECT_URI`, `src/api/authorize.ts`):
   `https://0xbeef1eaf.github.io/tumblr-android/auth/callback`. Tumblr's app form only
   accepts http(s) callback URLs (it rejected `tumblrgallery://auth/callback`), so the
   callback is an https URL used purely as an identifier: it must match the user's app
   registration verbatim, but nothing is hosted or served there. Forks may override it
   with `EXPO_PUBLIC_OAUTH_REDIRECT_URI` (validated as https). Settings has a copy row.
   This replaces `expo-auth-session` and the `tumblrgallery://auth/callback` route; the
   `tumblrgallery` scheme stays for ordinary deep links.
   **Security note.** RFC 8252 discourages embedded WebViews for OAuth because the host app
   could read what the user types. Here the WebView is first-party (this open-source app,
   not a third party asking for Tumblr access) and the user supplies their own Tumblr app
   credentials, so the app is already the OAuth client acting for them; no page is
   injected with script and only the callback navigation is intercepted. The `state` check
   still guards the callback. Some identity providers (e.g. Google sign-in) refuse
   embedded WebViews; email/password sign-in on Tumblr works.
5. **Token exchange / refresh** (`src/api/auth.ts`, `resolveTokenEndpoint`), in order:
   - consumer secret entered in Settings → `POST https://api.tumblr.com/v2/oauth2/token`
     with `client_id` = consumer key and `client_secret`, in **all** builds;
   - secret from `EXPO_PUBLIC_TUMBLR_CLIENT_SECRET` → direct, **development builds only**
     (`__DEV__`); release builds ignore it;
   - `EXPO_PUBLIC_TOKEN_EXCHANGE_URL` → the optional proxy (`proxy/`), which adds its secret;
   - otherwise `AuthConfigError("Add your Tumblr app's consumer secret in Settings to sign
     in")` (or "consumer key and secret" when there is no key).
6. Tokens (`access_token`, `refresh_token`, `expires_at`) go in SecureStore.
   `client.ts` refreshes proactively when < 60 s remain and serialises
   concurrent refreshes with a single in-flight promise.
7. **Changing credentials**: saving new ones or "Remove credentials" signs out (tokens
   belong to the app that issued them) and drops the `blog`, `tagged`, `post`, `user`,
   `dashboard`, `likes` and `following` queries.
8. `useSession()` exposes `{ status: 'guest'|'signedIn'|'loading', user, signIn, signOut }`.

## 8. Performance budget

- Grid tile first paint ≤ 16 ms (no measurement; aspect ratio from data).
- Images: `expo-image` `cachePolicy="memory-disk"`, `recyclingKey=item.id`,
  `transition={200}`, `placeholder={{ backgroundColor }}`; grid variants ≤ 640 px.
- FlashList `estimatedItemSize` from median aspect; `drawDistance` 2 screens.
- GIFs: at most 6 animating on screen; off-screen tiles get `autoplay={false}`. On
  cellular with "Autoplay GIFs on cellular" off, no tile animates (first frame + `GIF`
  badge); the viewer still plays the GIF on tap.
- Network state: one app-lifetime `expo-network` listener (`src/lib/network.ts`) shared by
  every `useNetworkState()` via `useSyncExternalStore`; only changes to
  `isConnected`/`isCellular` re-render. The root layout feeds it to react-query's
  `onlineManager`, so offline queries pause (no retry storm) and resume on reconnect,
  while persisted pages stay browsable.
- Viewer prefetches ±1 page with `Image.prefetch`.
- Avoid re-renders: tiles memoised on `item.id` + `columnWidth` + `safeMode`.

## 9. Testing strategy

- `src/domain/*`: table-driven unit tests over fixtures (NPF photoset, NPF reblog
  with trail-only media, legacy photo, legacy video, text post → []).
- `src/api/client`: msw handlers for 200/401→refresh/429→retry/404; envelope parsing.
- Hooks: `renderHook` with a test QueryClient and msw.
- Components: `MasonryGallery` renders N tiles and opens the viewer store;
  `SearchBar` debounce and suggestions; `SettingsScreen` toggles persist.
- No live API calls in tests. `src/test/setup.ts` seeds the credentials store with
  `{ consumerKey: 'test' }` before each test; env fallbacks are unset under jest and tests
  that need them pass an `Env` explicitly.
- Smoke: `npx expo export --platform android` must succeed (Metro bundles the app) with no
  environment variables set.

## 10. Configuration & secrets

Credentials are runtime configuration: the user enters their Tumblr app's consumer key and
secret in Settings (SecureStore, §7). Nothing is required at build time, and `parseEnv`
accepts an empty environment.

`.env.example` lists the **optional** fallbacks for a pre-configured build:
```
EXPO_PUBLIC_TUMBLR_API_KEY=        # built-in consumer key ("Using built-in key")
EXPO_PUBLIC_TOKEN_EXCHANGE_URL=    # optional proxy: https://<worker>.workers.dev/token
EXPO_PUBLIC_TUMBLR_CLIENT_SECRET=  # dev builds only; ignored in release; never in EAS profiles
EXPO_PUBLIC_OAUTH_REDIRECT_URI=    # forks: own https callback URL (default OAUTH_REDIRECT_URI)
```
Values entered in Settings always win. `EXPO_PUBLIC_*` values are inlined into the bundle,
so a distributed build must never carry a secret; use the proxy instead.

`app.config.ts` reads these; `scheme: 'tumblrgallery'`; Android package
`com.tumblrgallery.app`; `android.blockedPermissions` keeps the manifest minimal
(`WRITE_EXTERNAL_STORAGE` not needed on API 29+; saving uses `expo-media-library`
scoped access).

## 11. Delivery phases

- **P0 Foundation**: scaffold, theme, nav shell, client, schemas, normalizer, tests, CI.
- **P1 Gallery + Search** (guest usable): tag/blog galleries, search, viewer, explore.
- **P2 Account**: OAuth2, dashboard, likes, follow, like/reblog, post detail actions.
- **P3 Polish**: settings, safe mode, cache controls, saving media, haptics, README, EAS.
