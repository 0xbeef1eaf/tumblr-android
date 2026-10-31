# Tumblr Gallery

A gallery-first Tumblr client for Android (iOS kept working), built with Expo SDK 58,
React Native 0.88 and expo-router. Every surface — tags, blogs, search, your dashboard —
is a masonry grid of images, GIFs and video, and every item opens in a full-screen,
zoomable viewer.

- **Guest browsing**: no account needed. Public tags and blogs work with just an API key.
- **Optional sign-in**: OAuth2 adds your dashboard, likes, follows and reblogs.
- **Safe mode**, grid density, autoplay and cache controls live in the Settings tab.

> Not affiliated with or endorsed by Tumblr, Inc. Use of the Tumblr API is subject to the
> [Tumblr API terms](https://www.tumblr.com/docs/en/api_agreement).

## Screenshots

_Screenshots coming soon._ <!-- Add images under docs/screenshots/ and link them here. -->

## Requirements

- Node.js 22.12 or newer and npm
- A Tumblr OAuth application (see below) for the consumer key
- For on-device testing: an Android device or emulator and a **development build**. Native
  modules (MMKV, SecureStore, expo-video, …) mean Expo Go is not enough.
- For cloud builds: an [Expo](https://expo.dev) account and `npm i -g eas-cli` (>= 16)

You do not need a local Android SDK to develop; typecheck, lint, tests and the Metro bundle
check all run on plain Node.

## Setup

```sh
npm ci
cp .env.example .env     # then fill in the values described below
```

| Variable                           | Required    | Purpose                                                           |
| ---------------------------------- | ----------- | ----------------------------------------------------------------- |
| `EXPO_PUBLIC_TUMBLR_API_KEY`       | yes         | OAuth consumer key of your Tumblr app (public by design)          |
| `EXPO_PUBLIC_TOKEN_EXCHANGE_URL`   | for sign-in | URL of the token-exchange proxy that adds the client secret       |
| `EXPO_PUBLIC_TUMBLR_CLIENT_SECRET` | dev only    | Lets dev builds exchange tokens directly; never set in production |

`EXPO_PUBLIC_*` values are inlined into the JavaScript bundle, so **never** put a secret in
a build you distribute. Under Jest the API key defaults to `test`; no test or CI job calls
the live API (requests are served by [msw](https://mswjs.io) from `src/api/fixtures/`).

### Register a Tumblr app

1. Sign in to Tumblr and open <https://www.tumblr.com/oauth/apps>, then choose **Register
   application**.
2. Fill in the name, description and a website URL.
3. Set the **Default callback URL** (OAuth2 redirect URL) to `tumblrgallery://auth/callback`.
4. Save, then copy the **OAuth Consumer Key** into `EXPO_PUBLIC_TUMBLR_API_KEY`. Keep the
   **Consumer Secret** private: it goes only into the token-exchange proxy.

With just the consumer key, guest browsing works. Signing in also needs the proxy below.

### Token-exchange proxy

Tumblr's OAuth2 token endpoint requires a `client_secret`, and its docs describe no PKCE
flow, so a mobile app cannot complete the code exchange without shipping the secret. The
app therefore sends the authorization code to a tiny stateless proxy that adds the secret
and forwards the request to `https://api.tumblr.com/v2/oauth2/token`.

- Reference implementation (Cloudflare Worker) and deployment steps: [`proxy/README.md`](proxy/README.md).
- Point the app at it with `EXPO_PUBLIC_TOKEN_EXCHANGE_URL=https://<worker>.workers.dev/token`.
- For local development only, you may instead set `EXPO_PUBLIC_TUMBLR_CLIENT_SECRET` and
  leave the URL empty; the app then calls Tumblr directly. Production builds require the proxy.

See [docs/ARCHITECTURE.md §7](docs/ARCHITECTURE.md) for the full flow.

## Running

```sh
npx expo start                       # Metro; open in a development build
npx expo run:android                 # local dev build (needs the Android SDK)
eas build -p android --profile development   # dev-client APK in the cloud
eas build -p android --profile preview       # installable APK for testers
eas build -p android --profile production    # Play Store app bundle (AAB)
```

EAS profiles are defined in [`eas.json`](eas.json). Replace the placeholder
`EXPO_PUBLIC_*` values there (or use EAS environment variables) before building; do not set
`EXPO_PUBLIC_TUMBLR_CLIENT_SECRET` in any distributed profile. `submit.production` is a stub for
Google Play: supply your own service-account key (kept out of git) before `eas submit`.

## Scripts

| Script                          | What it does                                                |
| ------------------------------- | ----------------------------------------------------------- |
| `npm start` / `android` / `ios` | Start Metro (optionally opening a device)                   |
| `npm run typecheck`             | `tsc --noEmit` (strict)                                     |
| `npm run lint` / `lint:fix`     | ESLint (`eslint-config-expo` + Prettier)                    |
| `npm run format`                | Prettier write                                              |
| `npm test` / `test:watch`       | Jest (`jest-expo` preset, msw)                              |
| `npm run export:android`        | `expo export --platform android`, a Metro bundle smoke test |

`export:android` needs `EXPO_PUBLIC_TUMBLR_API_KEY` set; any placeholder works.

## Project structure

```
app/            expo-router routes (thin; compose feature screens)
src/api/        fetch client, zod schemas, endpoints, OAuth token plumbing, fixtures
src/domain/     normalizePost -> GalleryItem, media variant selection, text helpers
src/features/   feature modules: auth, settings, gallery, viewer, search, explore,
                tag, blog, post
src/ui/         theme tokens and primitives (Text, Pressable, Chip, Sheet, Toast, Icon, Skeleton)
src/lib/        env, storage (MMKV), react-query client + persister, logging
src/test/       jest setup, native mocks, msw handlers
proxy/          Cloudflare Worker token-exchange reference
docs/           design, architecture, API notes, work plan
```

Routes in `app/` only compose screens from `src/features/*`; features never import each
other except through exported hooks; `src/api` knows nothing about React.

## Testing

Tests live beside the source (`*.test.ts(x)` under `src/`, never under `app/`). Domain code
is covered with table-driven tests over recorded fixtures, API code with msw handlers, and
screens with React Native Testing Library.

```sh
npm run typecheck && npm run lint && npm test
```

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs the same checks plus
`npm run export:android` on every push and pull request.

## Documentation

- [docs/DESIGN.md](docs/DESIGN.md): screens, gallery tile, visual tokens, accessibility
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): stack, layout, data flow, auth, testing, config
- [docs/API.md](docs/API.md): Tumblr API notes, endpoints and post shapes
- [docs/PLAN.md](docs/PLAN.md): work packages and conventions
- [CONTRIBUTING.md](CONTRIBUTING.md): how to contribute

## Licence

[MIT](LICENSE) (c) Tumblr Gallery contributors.
