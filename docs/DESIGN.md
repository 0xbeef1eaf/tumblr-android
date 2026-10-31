# Tumblr Gallery — Product & UX Design

A mobile-first, gallery-style Tumblr client. The app treats Tumblr as a stream of
images, GIFs and video rather than a text feed: every surface is a masonry grid of
media, and every piece of media opens into a full-screen viewer. Search is a
first-class tab.

Target: Android first (project name is `tumblr-android`), iOS kept working via Expo.

## 1. Product principles

1. **Media first.** Text-only posts are hidden from gallery surfaces by default.
   Captions, tags and notes live one tap away in the post detail sheet.
2. **Works without an account.** Browsing tags and blogs needs only a consumer
   key: the user's own Tumblr app, entered once in Settings (or one built in).
   Login adds dashboard, likes, follows and reblogs.
3. **Fast and quiet.** Progressive image loading with Tumblr's dominant-colour
   placeholders, aggressive disk caching, no layout shift (aspect ratios are
   known before images load), no spinners where a skeleton will do.
4. **Respectful.** No scraping, no re-implementation of the official dashboard
   beyond what the API offers, NSFW blurred by default, honours Tumblr rate limits.

## 2. Information architecture

```
Root (expo-router)
├── (tabs)
│   ├── index        Explore   — starter tags, recent searches, followed blogs (if signed in)
│   ├── dashboard    Dashboard — signed-in only; media from followed blogs
│   ├── search       Search    — query → tag results / blog jump
│   ├── likes        Likes     — signed-in: /user/likes; guest: local bookmarks
│   └── settings     Settings  — account, grid density, safe mode, cache
├── tag/[tag]              Gallery for a tag (also reached from a tag chip)
├── blog/[name]            Blog header + gallery, optional in-blog tag filter
├── post/[blog]/[id]       Post detail: all media, caption, tags, notes, actions
└── viewer                 Full-screen media viewer (modal, transparent card)
```

Tabs: Explore, Dashboard (hidden when signed out), Search, Likes, Settings.

## 3. Screens

### 3.1 Explore (`/`)
- Header: app name, sign-in button (guest) or avatar (signed in).
- Section "Recent": horizontally scrolling chips of last 10 searches/tags.
- Section "Start here": curated starter tags (`photography`, `illustration`,
  `architecture`, `gif`, `nature`, `fashion`, `art`, `design`, `cats`, `space`).
  Each chip shows a 3-up preview strip fetched lazily from `/tagged`.
- Signed in: section "Following" — avatar row of followed blogs → `blog/[name]`.
- **Onboarding** (no consumer key in Settings and none built in): "Start here" is
  replaced by a card — key icon, "Connect your Tumblr app", one line explaining that
  the app uses the user's own Tumblr app, and an "Open Settings" action
  (`router.push('/settings')`). No preview requests are made. The same card is the
  empty/error state of Search results, Tag and Blog, whose queries stay disabled until a
  key is saved. Sign-in buttons with a key but no secret (and no proxy) do not open the
  browser; they toast "Add your Tumblr app's consumer secret in Settings to sign in" with
  a "Settings" action.

### 3.2 Dashboard (`/dashboard`, auth)
- Masonry gallery of media from `/user/dashboard?npf=true`.
- Pull to refresh; infinite scroll via `since_id`/`offset` paging.
- Empty state when the user follows nobody with media.

### 3.3 Search (`/search`)
- Search bar auto-focused on tab open; debounced 300 ms.
- While typing: suggestions list
  - "Tag: #query" (always first)
  - "Blog: query.tumblr.com" (shown when query looks like a blog name: `[a-z0-9-]{1,32}`)
  - Recent searches (removable, swipe or x)
- Submit → results as masonry gallery (same component as tag screen) with a
  sticky filter row: `All · Photos · GIFs · Video` (client-side filter on media kind).
- Tumblr has no public full-text search API; search is tag search. The UI says
  "Search tags and blogs" so expectations are set.

### 3.4 Tag gallery (`/tag/[tag]`)
- Title `#tag`, follow-tag button is out of scope (no API). Share button.
- Masonry gallery, paginated by `before` timestamp.
- Filter row as in Search.

### 3.5 Blog (`/blog/[name]`)
- Collapsing header: avatar (128px), title, name, description (HTML stripped,
  2 lines, expandable), Follow/Unfollow (auth), post count.
- Tag filter chip row built from tags seen in loaded posts; tapping sets `?tag=`.
- Masonry gallery of `/blog/{name}/posts?npf=true`, paginated by `before`.

### 3.6 Post detail (`/post/[blog]/[id]`)
- Vertical list of all media in the post at full width (respecting NPF `rows`
  layout for side-by-side images), followed by caption text (NPF text blocks
  rendered with basic formatting; legacy HTML stripped to text + links),
  tag chips, note count, timestamp, source blog.
- Bottom action bar: Like (auth), Reblog (auth, opens confirm sheet with
  optional comment and tags), Share, Open in browser, Save image(s).
- Reblog trail is shown collapsed ("via blogname") with expand.

### 3.7 Viewer (`/viewer`, modal)
- Receives a list of `GalleryItem` ids + start index from a shared in-memory
  store (not via URL, to avoid serialising large arrays).
- Horizontal pager (one item per page), each page a pinch-zoom/pan image
  (double-tap to zoom), GIFs animate, video plays via `expo-video` with native
  controls, muted by default.
- Tap toggles chrome: top bar (close, index "3 / 12"), bottom bar (blog name →
  blog, caption excerpt → post detail, like, share, save).
- Swipe down to dismiss with scale/fade.
- Loads the highest-resolution variant appropriate to the screen (see
  ARCHITECTURE §5.3); shows the cached grid thumbnail until it arrives.

### 3.8 Settings (`/settings`)
- **Tumblr API** (first section):
  - Status row: "Using your credentials" / "Using built-in key" / "Not configured",
    with a one-line explanation.
  - "Consumer key" (masked `abcd…wxyz`, or "Not set") and "Consumer secret" ("Saved on
    this device" / "Not set: needed to sign in"). Either row opens the credentials
    sheet: two text fields — key visible, secret `secureTextEntry` with an eye toggle —
    a note that values stay on the device and saving signs out, and Cancel / Save.
    Values are trimmed; an empty key shows an inline error. Saving changed values
    signs out and drops cached gallery and user data; saving identical values just closes.
  - "Remove credentials" (danger, only when the user entered some) → confirm sheet
    "Remove your credentials?" → deletes them and signs out.
  - Help: "Set up your Tumblr app" with three numbered steps, a "Callback URL" row
    showing `tumblrgallery://auth/callback` that copies it (toast "Callback URL
    copied"), and an "Open Tumblr apps page" link to https://www.tumblr.com/oauth/apps.
- Account: Sign in / Sign out, shows primary blog name.
- Grid: columns 2 / 3 (default 2 on phones < 600 dp, 3 otherwise), show
  blog name overlay on tiles (on/off).
- Content: Safe mode (blur items whose post is flagged by Tumblr or whose
  blog `is_adult`/`is_nsfw`; default on), autoplay GIFs on cellular (default on),
  autoplay video (default off).
- Storage: image cache size, "Clear cache", "Clear search history".
- About: version, licences, link to Tumblr API terms.

## 4. Gallery tile

- Masonry: items keep their true aspect ratio, clamped to [0.5, 2.0] so one
  tall image cannot dominate a column.
- Placeholder: solid colour from NPF `colors.c0` (or neutral surface) with a
  subtle shimmer; fades into the image over 200 ms.
- Overlays (bottom-left, hidden when "show blog name" is off): blog avatar 20px
  + name. Top-right badges: `GIF`, `▶ 0:12` (video), `1/4` (photoset).
- Tap → viewer. Long press → quick-action sheet (Open post, Open blog, Like,
  Share, Save, Copy link, Hide blog).
- Safe-mode items render blurred (`expo-image` blurRadius 30) with a "Sensitive"
  label; tap reveals for the session.

## 5. Visual design

- Design tokens live in `src/ui/theme.ts`; light and dark follow system.
- Palette (dark default — galleries look better on dark):
  - background `#0f0f14` / light `#ffffff`
  - surface `#1a1a22` / light `#f4f4f6`
  - text primary `#f5f5f7` / light `#111118`; secondary 60 % alpha
  - accent `#00b8ff` (Tumblr blue-ish, used sparingly: active tab, links, like)
  - like-active `#ff4930`
- Type: system font (Roboto / SF). Scale 12/14/16/20/24; weights 400/600.
- Spacing scale 4/8/12/16/24/32. Gutter between tiles 4 dp, outer margin 8 dp.
- Corner radius: tiles 8, chips 999, sheets 16.
- Motion: tile → viewer uses a fade + scale (shared-element transitions are a
  stretch goal); viewer dismiss follows the finger; lists use default FlashList.
- Haptics (`expo-haptics`): light on like, selection on filter change.

## 6. Accessibility

- Every tile has `accessibilityLabel` = alt text or "Image from {blog}".
- Viewer and sheets are reachable with TalkBack; chrome buttons have labels.
- Hit targets ≥ 44 dp. Respects reduced motion (disables shimmer and scale).

## 7. Empty, loading and error states

| State | Treatment |
|---|---|
| Loading first page | Skeleton masonry (12 tiles, random aspect ratios) |
| Loading next page | 3-tile skeleton row at the bottom |
| Empty tag | Illustration + "Nothing tagged #x yet" + "Try: …" suggestions |
| Blog not found (404) | "This blog doesn't exist or is private" |
| No consumer key | "Connect your Tumblr app" card with "Open Settings" (§3.1) |
| Rate limited (429) | Toast "Tumblr is asking us to slow down — retrying in Ns" |
| Offline | Banner at top; cached pages still browsable |
| Auth expired | Silent refresh; on failure, sign-out toast + Explore |

## 8. Out of scope (v1)

Posting new content, asks, messaging, notifications, communities, text-post
reading beyond captions, following tags, multi-account.
