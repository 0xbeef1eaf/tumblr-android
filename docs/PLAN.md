# Work plan — packages for implementation agents

All packages implement docs/DESIGN.md + docs/ARCHITECTURE.md + docs/API.md. Verification
without an Android SDK: `npm run typecheck`, `npm run lint`, `npm test`, `npx expo export
--platform android` (Metro bundle smoke). No live Tumblr calls; msw fixtures only.

## WP1 — Foundation (sequential; everything else depends on it)
Owner model: Opus.
- `npx create-expo-app@latest . --template blank-typescript` (SDK 58), then
  `npx expo install` every dependency listed in ARCHITECTURE §1 so later packages
  never touch `package.json`.
- `tsconfig` strict + `@/` path alias; eslint (expo config) + prettier; jest-expo
  preset; `npm run typecheck|lint|test|export:android` scripts.
- `app.config.ts` (scheme, android package, env plumbing), `.env.example`, `.gitignore`.
- `src/lib/{env,storage,queryClient,log}.ts`, `src/ui/theme.ts` + primitives
  (Text, Pressable, Chip, Sheet, Toast, Icon, Skeleton).
- `src/api/client.ts` (auth header/api_key, UA, envelope, ApiError, 429 backoff,
  401→refresh hook point), `src/api/schemas/*` (zod, passthrough), `src/api/endpoints/*`
  (typed functions for every call in API.md), `src/api/fixtures/*` + `src/test/msw.ts`
  handlers, `src/api/auth.ts` with the token store **interface** and SecureStore impl
  (OAuth flow itself is WP4).
- `src/domain/{galleryItem,media,text}.ts` with full unit tests (table-driven).
- Navigation shell: `app/_layout.tsx` providers, `(tabs)/_layout.tsx` with all five
  tabs (Dashboard hidden when `useSession().status !== 'signedIn'`), and **placeholder
  screens for every route in DESIGN §2** (so later packages only fill files in).
- `src/features/auth/authStore.ts` + `useSession()` returning `guest` for now.
- `src/features/settings/settingsStore.ts` (columns, showBlogName, safeMode, autoplay*).
- README stub. Commit on branch `ccr-90890613-n354pd`.

## WP2 — Gallery & viewer (parallel after WP1)
Owner model: Opus (gesture/animation heavy).
Files: `src/features/gallery/**`, `src/features/viewer/**`, `app/viewer.tsx`.
- `MasonryGallery` (FlashList masonry, columns from settings, aspect clamp,
  skeletons, footer loader, pull-to-refresh, `onEndReached`), `GalleryTile`
  (expo-image, placeholder colour, badges, overlay, safe-mode blur, long-press sheet),
  `useGalleryPaging(queryFn, key, cursorFn)` generic infinite query → flat deduped items.
- `viewerStore` (zustand, non-persisted): `open(items, index)`, current index.
- Viewer: pager (`react-native-pager-view` or reanimated horizontal list),
  `ZoomableImage` (pinch/pan/double-tap, bounds-clamped), `VideoPage` (expo-video),
  chrome toggle, swipe-down dismiss, prefetch ±1, save (expo-media-library) & share.
- Tests: tile renders badges/labels; gallery dedupes and opens viewer; pickVariant usage.

## WP3 — Search, Explore, Tag, Blog (parallel after WP1)
Owner model: Sonnet.
Files: `src/features/{search,explore,tag,blog}/**`, `app/(tabs)/index.tsx`,
`app/(tabs)/search.tsx`, `app/tag/[tag].tsx`, `app/blog/[name].tsx`.
- Search tab per DESIGN §3.3 (debounce, suggestions, history store persisted via MMKV,
  kind filter row, results via `MasonryGallery` + `useTaggedPosts`).
- Explore per §3.1 (starter tags with lazy preview strips, recent chips, following row
  via `useFollowing` from WP4 if present else hidden).
- Tag screen (`before` paging, featured_timestamp fallback). Blog screen (collapsing
  header, info query, avatar URL, tag chips, `?tag=` filter, Follow button wired to
  WP4's `useFollow` behind `useSession`).
- Tests: suggestions logic, history store, cursor derivation for tagged/blog paging.

## WP4 — Account: OAuth2, dashboard, likes, post detail actions (parallel after WP1)
Owner model: Sonnet.
Files: `src/features/{auth,post}/**` (authStore from WP1 is extended, not replaced),
`src/api/auth.ts` (flow), `app/(tabs)/dashboard.tsx`, `app/(tabs)/likes.tsx`,
`app/post/[blog]/[id].tsx`, `app/auth/callback.tsx`, `proxy/` (Cloudflare Worker
token-exchange reference + README).
- OAuth2 per ARCHITECTURE §7 with expo-auth-session; token exchange via proxy URL or
  dev secret; SecureStore persistence; proactive refresh with single in-flight promise;
  401 → refresh → sign-out fallback wired into `client.ts`'s hook point.
- `useSession`, `useUser`, `useDashboard`, `useLikes` (guest: local bookmarks store),
  `useFollowing`, `useFollow(blogName)`, `useLike(item)` optimistic, `useReblog`.
- Post detail screen per DESIGN §3.6 incl. `NpfRenderer` (text blocks with formatting,
  rows layout for images, trail collapsed) and action bar.
- Tests: token refresh race, 401 flow, like optimistic rollback, NpfRenderer snapshot.

## WP5 — Settings, CI, EAS, README (parallel after WP1)
Owner model: Sonnet (Haiku acceptable for docs/CI only).
Files: `src/features/settings/SettingsScreen.tsx` + tests, `app/(tabs)/settings.tsx`,
`.github/workflows/ci.yml`, `eas.json`, `README.md`, `CONTRIBUTING.md`, `LICENSE` (MIT).
- Settings per DESIGN §3.8 incl. cache size/clear via expo-image `clearDiskCache`,
  clear search history, sign in/out via `useSession`.
- CI: node 22, `npm ci`, typecheck, lint, test, `expo export --platform android`.
- EAS profiles: development (dev client), preview (APK, internal), production (AAB).
- README: setup, env vars, how to register a Tumblr app, proxy deployment, scripts.

## Integration (after WP2–WP5)
- Run all checks, fix cross-package seams (Explore↔following, Blog↔follow, tiles↔like),
  code review pass, then commit + push.

## Conventions for all agents
- Branch `ccr-90890613-n354pd`; commit with clear messages; do not push (integrator pushes).
- Do not edit `package.json`/lockfile after WP1; if a dep is truly missing, add it with
  `npx expo install <pkg>` and say so in your report.
- TypeScript strict, no `any` without a comment. Functional components, hooks, no classes.
- Every new module gets at least one test. Keep files < 300 lines.
- Only touch the files your package owns; shared files are listed per package.
