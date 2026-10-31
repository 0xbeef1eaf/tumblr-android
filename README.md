# Tumblr Gallery

A media-first Tumblr client for Android (iOS kept working) built with Expo SDK 58,
React Native 0.88 and expo-router. Every surface is a masonry grid of images, GIFs and
video; every item opens in a full-screen viewer. Browsing tags and blogs works without
an account (API key only); signing in adds dashboard, likes, follows and reblogs.

Specs live in [`docs/`](docs/): [DESIGN](docs/DESIGN.md), [ARCHITECTURE](docs/ARCHITECTURE.md),
[API notes](docs/API.md) and the [work plan](docs/PLAN.md).

## Getting started

```sh
npm ci
cp .env.example .env   # then fill in EXPO_PUBLIC_TUMBLR_API_KEY
npm run start          # Metro; open in a development build (expo-dev-client)
```

Native modules (MMKV, SecureStore, expo-video, …) mean Expo Go is not enough — use a
development build (`npx expo run:android` or an EAS `development` build).

## Environment

| Variable                           | Required    | Purpose                                                                        |
| ---------------------------------- | ----------- | ------------------------------------------------------------------------------ |
| `EXPO_PUBLIC_TUMBLR_API_KEY`       | yes         | OAuth consumer key from <https://www.tumblr.com/oauth/apps> (public by design) |
| `EXPO_PUBLIC_TOKEN_EXCHANGE_URL`   | for sign-in | Token-exchange proxy that adds the client secret                               |
| `EXPO_PUBLIC_TUMBLR_CLIENT_SECRET` | dev only    | Lets dev builds exchange tokens directly; never set in production              |

Under Jest the API key defaults to `test`. No test or CI job ever calls the live API —
requests are served by [msw](https://mswjs.io) from `src/api/fixtures/`.

## Scripts

| Script                              | What it does                                               |
| ----------------------------------- | ---------------------------------------------------------- |
| `npm run start` / `android` / `ios` | Start Metro (optionally opening a device)                  |
| `npm run typecheck`                 | `tsc --noEmit` (strict)                                    |
| `npm run lint`                      | ESLint (`eslint-config-expo` + Prettier)                   |
| `npm test`                          | Jest (`jest-expo` preset, msw)                             |
| `npm run export:android`            | `expo export --platform android` — Metro bundle smoke test |

`export:android` needs `EXPO_PUBLIC_TUMBLR_API_KEY` set (any placeholder works).

## Layout

```
app/            expo-router routes (thin; compose feature screens)
src/api/        fetch client, zod schemas, endpoints, OAuth token plumbing, fixtures
src/domain/     normalizePost → GalleryItem, media variant selection, text helpers
src/features/   feature modules (auth, settings, gallery, viewer, search, …)
src/ui/         theme tokens and primitives (Text, Pressable, Chip, Sheet, Toast, Icon, Skeleton)
src/lib/        env, storage (MMKV), react-query client + persister, logging
src/test/       jest setup, native mocks, msw handlers
```
