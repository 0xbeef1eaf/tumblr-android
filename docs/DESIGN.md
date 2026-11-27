# Tumblr Gallery — Product & UX Design

A mobile-first, gallery-style Tumblr client. The app treats Tumblr as a stream of
images, GIFs and video rather than a text feed: every surface is a masonry grid of
media, and every piece of media opens into a full-screen viewer. Search (tags and
blogs) opens from Explore.

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
│   ├── dashboard    Dashboard — initial tab; media from followed blogs (guest: sign-in prompt)
│   ├── for-you      For You   — Tumblr's recommendations (guest: sign-in prompt)
│   ├── notifications Notifications — activity on the primary blog (guest: sign-in prompt)
│   ├── index        Explore   — search entry, starter tags, recent searches; signed in: followed blogs + "Blogs you might like"
│   ├── likes        Likes     — signed-in: /user/likes; guest: local bookmarks
│   └── settings     Settings  — account, grid density, safe mode, cache
├── search                 Search — query → tag results / blog jump (opened from Explore)
├── tag/[tag]              Gallery for a tag (also reached from a tag chip)
├── blog/[name]            Blog header + gallery, optional in-blog tag filter
├── post/[blog]/[id]       Post detail: all media, caption, tags, notes, actions
├── viewer                 Full-screen media viewer (modal, transparent card)
└── auth/sign-in           Tumblr sign-in page in an in-app WebView (modal)
```

Tabs, in order: Dashboard, For You, Notifications, Explore, Likes, Settings (icons `albums`,
`sparkles`, `notifications`, `compass`, `heart`, `settings`). All are always visible; Dashboard,
For You and Notifications show a sign-in prompt to guests. Search is not a tab: it is a stack
screen at `/search` (header with back) opened from Explore. A plain launch opens Dashboard
(`unstable_settings.initialRouteName` plus `app/+native-intent.ts`, which sends the launcher's
root URL to `/dashboard`); Explore stays at `/`.

## 3. Screens

### 3.1 Explore (`/`)
- Header: app name, sign-in button (guest) or avatar (signed in).
- Search pill "Search tags and blogs" under the header → `/search` (§3.3).
- Section "Recent": horizontally scrolling chips of last 10 searches/tags.
- Section "Start here": curated starter tags (`photography`, `illustration`,
  `architecture`, `gif`, `nature`, `fashion`, `art`, `design`, `cats`, `space`).
  Each chip shows a 3-up preview strip fetched lazily from `/tagged`.
- Signed in: section "Following" — avatar row of followed blogs → `blog/[name]`.
- Signed in: section "Blogs you might like" (subtitle "Followed by blogs you follow"),
  right after Following — who the blogs you follow follow. Built from the public
  `/blog/{name}/following` first page of the 15 most recently followed blogs (3 requests
  at a time; blogs that hide their list add nothing). Blogs you already follow (the first
  100 of your following list) and your own blogs are left out; past 100 followed blogs,
  each shown row checks `/blog/{name}/info` and reads "Following" if it is already
  followed. Nothing is shown until that exclusion list has loaded (skeleton meanwhile), so
  rows never appear and then vanish. The rest are ranked by how many of those blogs follow
  them, then by latest post, top 30. Rows: avatar, name, title (1 line), "Followed by
  alice, bob +3", Follow button; row → `blog/[name]`. Five rows, then "Show N more". A row
  followed here stays, showing "Following" (tap again to undo). The sources are fixed while
  the screen is open, so following someone does not reshuffle the list. Lists are cached
  6 h per blog (1 h for the ranking). Skeleton rows while loading; hidden for guests and
  when there is nothing to suggest.
- **Onboarding** (no consumer key in Settings and none built in): "Start here" is
  replaced by a card — key icon, "Connect your Tumblr app", one line explaining that
  the app uses the user's own Tumblr app, and an "Open Settings" action
  (`router.push('/settings')`). No preview requests are made. The same card is the
  empty/error state of Search results, Tag and Blog, whose queries stay disabled until a
  key is saved. Sign-in buttons with a key but no secret (and no proxy) do not open the
  sign-in screen; they toast "Add your Tumblr app's consumer secret in Settings to sign in" with
  a "Settings" action.

### 3.2 Dashboard (`/dashboard`, auth)
- Masonry gallery of media from `/user/dashboard?npf=true`.
- Pull to refresh; infinite scroll via `since_id`/`offset` paging.
- Empty state when the user follows nobody with media.
- Guests: centred sign-in prompt (the tab is always shown).

### 3.2b For You (`/for-you`, auth)
- Masonry gallery of Tumblr's recommended posts from `GET /v2/tabs/for_you` — not in the
  public API docs (Tumblr's own clients use it), so it may stop working (API.md).
- Pull to refresh; infinite scroll with the opaque `cursor` from `_links.next`.
- Heart / long-press like as on Dashboard.
- Guests: sign-in prompt. 403/404 from Tumblr: "Tumblr doesn't offer this feed to
  third-party apps right now" with a "Go to Dashboard" button. Other errors: retry message.

### 3.2c Notifications (`/notifications`, auth)
- List of activity on the signed-in user's primary blog from
  `GET /v2/blog/{primary}/notifications` (API.md), newest first.
- Row: unread dot, from-blog avatar (`from_tumblelog_avatar`, else the avatar endpoint),
  sentence with the blog name in bold — "**alice** liked your post", "reblogged your post"
  (with the added text quoted), "replied: “…”", "started following you", "sent you an ask",
  "answered your ask", "mentioned you", "credited you in a post", "joined your group blog",
  "replied in a conversation"; moderation notices (`post_flagged`, `post_appeal_*`) and
  `what_you_missed` read as from "Tumblr". Unknown types read "interacted with your post"
  when about a post, "has new activity for you" when only the sender is known, else "You
  have a new notification" — the age ("5m", "3h", "2d", "4w", then a date) and a
  thumbnail of your post when Tumblr sends one. Anonymous asks show "Anonymous".
- Tap: a new follower opens their blog; anything about a post opens
  `/post/{target_tumblelog_name}/{target_post_id}`; otherwise the other blog. Tapping the
  avatar opens the other blog.
- Filter chips: All · Mentions · Reblogs · Replies · Follows · Likes (server-side `types[]`:
  `mention_in_reply`+`mention_in_post`, `reblog_naked`+`reblog_with_content`, `reply`,
  `follow`, `like`).
- Pull to refresh (first page only, as on Dashboard); infinite scroll with the `before`
  cursor from `_links.next`.
- States: guests get the sign-in prompt; skeleton rows while loading; "No notifications
  yet" (with a filter: "No mentions yet" etc. and a "Show all" action); a failed later page
  keeps the list and shows "Couldn't load more · Try again" at the end; 403 → "Tumblr
  didn't allow this app to read your blog's notifications"; other errors → retry message; an
  account without a blog → "No blog to show".

### 3.3 Search (`/search`)
- A stack screen over the tabs (title "Search", back returns to Explore), opened from the
  search entry on Explore; not a tab. Deep links to `/search` still work.
- Search bar auto-focused each time the screen opens; debounced 300 ms.
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
- Masonry gallery. Signed in: `/v2/timeline/search` (recent), paged by its `_links.next`, so
  mature posts appear when the account shows them; guests (and the fallback): `/v2/tagged`,
  paginated by `before` timestamp (see API.md).
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
  (zoom is pinch only), GIFs animate (the current page only, restarting when swiped back
  to; never the poster still), video plays via `expo-video` with native
  controls, muted by default.
- Double-tap on an image **likes** the post (never unlikes; already liked → no-op;
  guests get an on-device bookmark, as with the heart). A heart bursts over the
  centre of the image (scale + fade, ~600 ms; with reduced motion a plain 400 ms
  flash), with a light haptic tick. The chrome's heart updates at once.
- Tap toggles chrome: top bar (close, index "3 / 12"), bottom bar (blog name →
  blog, caption excerpt → post detail, like, share, save).
- Swipe down to dismiss with scale/fade.
- Media is fitted to the window minus the safe-area insets (status bar and display
  cutout on top, navigation bar at the bottom, left/right in landscape), so nothing
  sits under the camera cutout; the black backdrop stays full-bleed and zoom/pan
  bounds use the same inset box.
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
  - Help: "Set up your Tumblr app" with four numbered steps (register an application;
    any name and description, Application Website can be
    https://github.com/0xbeef1eaf/tumblr-android; paste the callback URL below as the
    "Default callback URL", noting that nothing needs to exist at it because sign-in runs
    in an in-app browser that catches it; copy the key and secret above), a "Callback
    URL" row showing `https://0xbeef1eaf.github.io/tumblr-android/auth/callback` (or a
    fork's `EXPO_PUBLIC_OAUTH_REDIRECT_URI`) that copies it (toast "Callback URL copied"),
    and an "Open Tumblr apps page" link to https://www.tumblr.com/oauth/apps.
- Sign in (`/auth/sign-in`, modal, no stack header): a header bar with the title "Sign in
  to Tumblr" and a Cancel button above a WebView showing Tumblr's authorize page; a
  centred spinner while a page loads. Load or HTTP failures replace the WebView with a
  readable message and Retry. Cancel or back closes it (sign-in cancelled, no toast);
  reaching the callback URL closes it and finishes sign-in. Opened with no sign-in in
  progress it shows "Nothing to sign in to." and goes straight back.
- Account: Sign in / Sign out, shows primary blog name.
- Grid: columns 2 / 3 (default 2 on phones < 600 dp, 3 otherwise), show
  blog name overlay on tiles (on/off).
- Feed buffer: for Dashboard and for For You separately, how many posts stay loaded
  ahead of the one shown in the full-screen viewer (10 / 20 / 40 / 80; default 20 for
  Dashboard, 40 for For You). Larger values mean more swiping before a wait, for more data
  and API calls.
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
- GIF tiles: up to 10 visible GIFs animate; any other GIF tile (beyond the 10, or on
  cellular with autoplay off) shows a still — the post's poster frame when Tumblr sends
  one, else the GIF paused on its first frame — with the `GIF` badge. A tile that starts
  animating swaps to the animated GIF and restarts it from the beginning.
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
| Loading next page | 3-tile skeleton row at the bottom; thin pages (text posts, recommendations) load the next page automatically until the grid can scroll |
| Pull to refresh | Spinner over the current first page; the feed restarts from a fresh page 1 (older pages are dropped and load again on scroll) |
| Empty tag | Illustration + "Nothing tagged #x yet" + "Try: …" suggestions |
| Blog not found (404) | "This blog doesn't exist or is private" |
| No consumer key | "Connect your Tumblr app" card with "Open Settings" (§3.1) |
| Rate limited (429) | Toast "Tumblr is asking us to slow down — retrying in Ns" |
| Offline | Banner at top; cached pages still browsable |
| Auth expired | Silent refresh; on failure, sign-out toast + Explore |

## 8. Out of scope (v1)

Posting new content, asks, messaging, communities, text-post reading beyond captions,
following tags, multi-account. Notifications are read-only (no marking as read, no replying).
