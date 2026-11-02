# Tumblr Gallery

A gallery-first Tumblr client for Android (iOS kept working), built with Expo SDK 58,
React Native 0.88 and expo-router. Every surface — tags, blogs, search, your dashboard —
is a masonry grid of images, GIFs and video, and every item opens in a full-screen,
zoomable viewer.

- **Bring your own credentials**: paste your Tumblr app's consumer key (and secret, to sign
  in) in Settings. Nothing is baked into the build.
- **Guest browsing**: no account needed. Public tags and blogs work with just the key.
- **Optional sign-in**: OAuth2 adds your dashboard, likes, follows and reblogs.
- **Safe mode**, grid density, autoplay and cache controls live in the Settings tab.

> Not affiliated with or endorsed by Tumblr, Inc. Use of the Tumblr API is subject to the
> [Tumblr API terms](https://www.tumblr.com/docs/en/api_agreement).

## Install

[**Install with Discoverium / Obtainium**](https://apps.obtainium.imranr.dev/redirect?r=obtainium://add/https://github.com/0xbeef1eaf/tumblr-android)
— adds this repository as an app source so new GitHub Releases install as updates.
[Discoverium](https://github.com/cygnusx-1-org/Discoverium) is an Obtainium fork and handles
the same `obtainium://` links; the page behind the button opens whichever is installed, or
explains how to get one. Or download the APK straight from
[Releases](https://github.com/0xbeef1eaf/tumblr-android/releases).

Releases are produced by the build workflow whenever a `v*` tag is pushed (see
[Builds](#builds)). The APK is debug-signed, so allow "install unknown apps" for your
installer. [`discoverium.yml`](discoverium.yml) holds the metadata for Discoverium's app
catalog; listing there is a pull request adding its raw URL to Discoverium's `apps.yml`.

## Screenshots

_Screenshots coming soon._ <!-- Add images under docs/screenshots/ and link them here. -->

## Requirements

- Node.js 22.12 or newer and npm
- A Tumblr OAuth application (see below): you enter its consumer key and secret in the app
- For on-device testing: an Android device or emulator and a **development build**. Native
  modules (MMKV, SecureStore, expo-video, …) mean Expo Go is not enough.
- For cloud builds: an [Expo](https://expo.dev) account and `npm i -g eas-cli` (>= 16)

You do not need a local Android SDK to develop; typecheck, lint, tests and the Metro bundle
check all run on plain Node.

## Setup

```sh
npm ci
npx expo start            # or install a development / preview build (see Running)
```

Then, in the app, open **Settings → Tumblr API** and paste your own Tumblr app's
**consumer key** and **consumer secret** (register one as described below). That's it: no
`.env`, no proxy, no rebuild.

- The **consumer key** is enough for guest browsing (tags, blogs, search). Without it the
  app shows a "Connect your Tumblr app" card instead of galleries.
- The **consumer secret** is needed to sign in. Because it is your own app's secret on your
  own device, the app exchanges and refreshes OAuth2 tokens directly with
  `https://api.tumblr.com/v2/oauth2/token`, in every build type.
- Both are stored only on the device, in `expo-secure-store` (Android Keystore / iOS
  Keychain), never in MMKV, the query cache or logs. "Remove credentials" deletes them and
  signs you out; saving new ones also signs you out, since tokens belong to the app that
  issued them.

No test or CI job calls the live API: requests are served by [msw](https://mswjs.io) from
`src/api/fixtures/`, and tests seed the credentials store with a dummy key `test`.

### Register a Tumblr app

1. Sign in to Tumblr and open <https://www.tumblr.com/oauth/apps> (Settings has an "Open
   Tumblr apps page" link), then choose **Register application**.
2. Fill in the name, description and a website URL.
3. Set the **Default callback URL** (OAuth2 redirect URL) to `tumblrgallery://auth/callback`
   (Settings → Tumblr API has a row that copies it).
4. Save, then copy the **OAuth Consumer Key** and **Secret Key** into Settings → Tumblr API.

### Optional: pre-configured builds

If you distribute a build to people who should not need their own Tumblr app, you can bake
fallbacks in at build time. Anything entered in Settings always wins over them.

```sh
cp .env.example .env     # all values are optional
```

| Variable                           | Purpose                                                                      |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| `EXPO_PUBLIC_TUMBLR_API_KEY`       | Built-in consumer key for guest browsing ("Using built-in key")              |
| `EXPO_PUBLIC_TOKEN_EXCHANGE_URL`   | Token-exchange proxy that adds the secret, so users of the build can sign in |
| `EXPO_PUBLIC_TUMBLR_CLIENT_SECRET` | Development builds only: direct exchange with the built-in key               |

`EXPO_PUBLIC_*` values are inlined into the JavaScript bundle, so **never** bake a secret into
a build you distribute; release builds ignore `EXPO_PUBLIC_TUMBLR_CLIENT_SECRET`. Use the
proxy instead: a tiny stateless Cloudflare Worker that adds the secret and forwards the grant
to Tumblr. Reference implementation and deployment steps:
[`proxy/README.md`](proxy/README.md).

See [docs/ARCHITECTURE.md §7](docs/ARCHITECTURE.md) for the full credential and sign-in flow.

## Running

```sh
npx expo start                       # Metro; open in a development build
npx expo run:android                 # local dev build (needs the Android SDK)
eas build -p android --profile development   # dev-client APK in the cloud
eas build -p android --profile preview       # installable APK for testers
eas build -p android --profile production    # Play Store app bundle (AAB)
```

EAS profiles are defined in [`eas.json`](eas.json). Their `EXPO_PUBLIC_*` values are
placeholders for the optional pre-configured fallbacks; replace or remove them (or use EAS
environment variables). Never set `EXPO_PUBLIC_TUMBLR_CLIENT_SECRET` in a distributed profile. `submit.production` is a stub for
Google Play: supply your own service-account key (kept out of git) before `eas submit`.

## Builds

[`.github/workflows/build-android.yml`](.github/workflows/build-android.yml) builds a release
APK with Gradle on every push to `main`, on every `v*` tag, and on demand (Actions → Build
Android → Run workflow). It runs `npx expo prebuild --platform android` (CNG: `android/` is
generated in CI and never committed) and then `./gradlew assembleRelease`.

- **Download a CI build:** open the workflow run and download the `tumblr-gallery-apk`
  artifact (kept 30 days). It is a zip containing `tumblr-gallery-v<version>.apk`.
- **Releases:** bump `version` in `package.json` (the Android `versionCode` derives from it),
  then push a matching tag such as `v1.2.0` (`git tag v1.2.0 && git push origin v1.2.0`); the
  same job creates a GitHub Release with `tumblr-gallery-v1.2.0.apk` attached and generated
  release notes. Obtainium/Discoverium install that asset directly.

> **Debug-signed.** The Expo template's `release` build type signs with the debug keystore.
> The APK installs on any device (allow "install unknown apps"), but it cannot be uploaded
> to Google Play, and Android will not update it in place with a build signed by a
> different key (uninstall first).

To sign with a real keystore, pick one:

- **EAS credentials (recommended):** `eas credentials -p android` creates or uploads a
  keystore that EAS manages; build with `eas build -p android --profile production` (AAB
  for Play) or `--profile preview` (APK).
- **Gradle signing via secrets:** store the keystore as a base64 repository secret (for
  example `ANDROID_KEYSTORE_BASE64`, plus `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
  `ANDROID_KEY_PASSWORD`). After the prebuild step, decode it to `android/app/release.jks`
  and add a `release` signing config, ideally through a small Expo config plugin so prebuild
  output stays reproducible, that reads those values from environment variables. Never
  commit the keystore (`*.jks` is gitignored).

**Optional EAS job.** The same workflow can also queue an EAS cloud build
(`eas build --platform android --profile preview --non-interactive --no-wait`). It runs only
when the repository variable `EAS_BUILD_ENABLED` is `true` (Settings → Secrets and variables
→ Actions → Variables), and needs an Expo access token in the `EXPO_TOKEN` secret (create it
at expo.dev → Account settings → Access tokens). The project must be linked to EAS first
(`eas init`), and the placeholder `EXPO_PUBLIC_*` values in the `preview` profile of
`eas.json` should be replaced or removed. The job exits once the build is queued; the APK
appears on expo.dev.

## Scripts

| Script                          | What it does                                                |
| ------------------------------- | ----------------------------------------------------------- |
| `npm start` / `android` / `ios` | Start Metro (optionally opening a device)                   |
| `npm run typecheck`             | `tsc --noEmit` (strict)                                     |
| `npm run lint` / `lint:fix`     | ESLint (`eslint-config-expo` + Prettier)                    |
| `npm run format`                | Prettier write                                              |
| `npm test` / `test:watch`       | Jest (`jest-expo` preset, msw)                              |
| `npm run export:android`        | `expo export --platform android`, a Metro bundle smoke test |

`export:android` needs no environment variables.

## Project structure

```
app/            expo-router routes (thin; compose feature screens)
src/api/        fetch client, zod schemas, endpoints, credentials store, OAuth plumbing, fixtures
src/domain/     normalizePost -> GalleryItem, media variant selection, text helpers
src/features/   feature modules: auth, credentials, settings, gallery, viewer, search,
                explore, tag, blog, post
src/ui/         theme tokens and primitives (Text, Pressable, Chip, Sheet, Toast, Icon, Skeleton)
src/lib/        env, storage (MMKV), react-query client + persister, logging
src/test/       jest setup, native mocks, msw handlers
proxy/          optional Cloudflare Worker token-exchange reference
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
`npm run export:android` on every push and pull request. Release APKs are built by a
separate workflow (see [Builds](#builds)).

## Documentation

- [docs/DESIGN.md](docs/DESIGN.md): screens, gallery tile, visual tokens, accessibility
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): stack, layout, data flow, auth, testing, config
- [docs/API.md](docs/API.md): Tumblr API notes, endpoints and post shapes
- [docs/PLAN.md](docs/PLAN.md): work packages and conventions
- [CONTRIBUTING.md](CONTRIBUTING.md): how to contribute

## Licence

[MIT](LICENSE) (c) Tumblr Gallery contributors.
