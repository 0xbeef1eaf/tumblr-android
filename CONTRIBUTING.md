# Contributing

Thanks for helping out. Read [docs/DESIGN.md](docs/DESIGN.md) and
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) first; [docs/PLAN.md](docs/PLAN.md) lists the
work packages and conventions summarised here.

## Setup

```sh
npm ci
cp .env.example .env    # set EXPO_PUBLIC_TUMBLR_API_KEY (see README)
```

## Branches and commits

- Work on a topic branch (for example `feat/blog-follow`, `fix/viewer-pinch`); do not
  commit to the default branch directly.
- Write clear, imperative commit messages with a short subject (about 70 characters) and a
  body explaining the why when it is not obvious. Keep commits focused.
- Open a pull request when ready. Maintainers integrate and push; do not force-push shared
  branches.
- Do not edit `package.json` or the lockfile casually. If a dependency is genuinely
  missing, add it with `npx expo install <pkg>` (so the version matches the SDK) and say so
  in the PR.

## Checks to run before pushing

```sh
npm run typecheck     # tsc --noEmit
npm run lint          # eslint . (Prettier is enforced through ESLint)
npm test              # jest
EXPO_PUBLIC_TUMBLR_API_KEY=placeholder npm run export:android   # Metro bundle smoke test
```

CI runs exactly these on every push and pull request. `npm run format` and
`npm run lint:fix` fix most style issues.

## Code rules

- TypeScript strict. No `any` unless commented with the reason.
- Functional components and hooks only; no classes.
- Keep files under 300 lines; split components and hooks before they grow past that.
- Use theme tokens and the primitives from `src/ui` instead of hard-coded colours and sizes.
  Touch targets are at least 44 dp and interactive elements need accessibility labels.
- `react-hooks` lint forbids reading `ref.current` during render.

## Testing rules

- Every new module gets at least one test, placed beside the source file
  (`Thing.tsx` -> `Thing.test.tsx`). **Never put tests under `app/`**: expo-router would
  bundle them as routes.
- React Native Testing Library 14 is fully async: `await render(...)`, `await renderHook(...)`,
  `await fireEvent.*(...)`.
- No live API calls. Use msw handlers and the recorded JSON in `src/api/fixtures/`
  (`src/test/msw.ts`); tests default `EXPO_PUBLIC_TUMBLR_API_KEY` to `test`.
- Mock native modules in `src/test/setup.ts` or per test (`expo-image`, secure store and
  MMKV are already mocked).

## Where things live

| Area                     | Location                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| Routes                   | `app/`: thin files that render a screen from `src/features/*`                                |
| Feature code             | `src/features/<feature>/`: gallery, viewer, search, explore, tag, blog, post, auth, settings |
| HTTP, schemas, endpoints | `src/api/`: no React in here                                                                 |
| Post normalisation       | `src/domain/`: `normalizePost`, media variants, text helpers                                 |
| Theme and primitives     | `src/ui/`                                                                                    |
| Env, storage, logging    | `src/lib/`                                                                                   |
| Token-exchange proxy     | `proxy/`                                                                                     |

Rules of thumb: routes contain no API calls; features may use `src/api`, `src/domain`,
`src/ui` and `src/lib`, and import other features only through their exported hooks.

## Secrets

Anything prefixed `EXPO_PUBLIC_` ends up in the app bundle. Never commit `.env`, keystores,
Play service-account keys or the Tumblr consumer secret. The consumer secret belongs only
in the token-exchange proxy's environment.

By contributing you agree that your work is licensed under the [MIT licence](LICENSE).
