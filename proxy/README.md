# Token-exchange proxy

> **Optional.** The app now uses the consumer key and secret each user enters in Settings and
> exchanges tokens directly; deploy this only for a pre-configured build without user secrets.

Tumblr's OAuth2 token endpoint requires the app's `client_secret`. A mobile app cannot keep a
secret, so this tiny stateless Cloudflare Worker adds it. The app talks to the Worker; the
Worker talks to `https://api.tumblr.com/v2/oauth2/token`.

This directory is independent of the Expo app: it has its own `package.json` and is not part
of the app's build.

## Request / response

`POST /token` with a JSON body, exactly what `src/api/auth.ts` sends:

```json
{ "grant_type": "authorization_code", "code": "…", "redirect_uri": "tumblrgallery://auth/callback", "client_id": "…" }
{ "grant_type": "refresh_token", "refresh_token": "…", "client_id": "…" }
```

The Worker adds `client_id` (its secret, if set) and `client_secret`, forwards the grant to
Tumblr as `application/x-www-form-urlencoded`, and returns Tumblr's status and JSON body
unchanged (`{ access_token, expires_in, token_type, scope, refresh_token }`), with CORS headers.
Any other `grant_type` is rejected with `400 unsupported_grant_type`. Requests are limited to
30 per minute per IP (best effort, per isolate) and bodies to 4 KB.

## Deploy

1. Register a Tumblr app at <https://www.tumblr.com/oauth/apps> with the redirect URL
   `tumblrgallery://auth/callback`.
2. `cd proxy && npm install`
3. `npx wrangler secret put TUMBLR_CLIENT_SECRET` (the app's OAuth consumer secret)
4. Optional: `npx wrangler secret put TUMBLR_CLIENT_ID`; otherwise the `client_id` sent by
   the app (the consumer key) is used.
5. `npm run deploy`, then set `EXPO_PUBLIC_TOKEN_EXCHANGE_URL=https://<name>.<account>.workers.dev/token`
   in the app's environment (EAS secret / `.env`).

`ALLOWED_REDIRECT_URIS` in `wrangler.toml` pins the redirect URIs the Worker will forward.
Add your Expo Go / dev-client URI there while developing. `ALLOWED_ORIGINS` (optional)
restricts browser origins; native apps do not need CORS.

## Local check

```sh
npx wrangler dev
curl -X POST localhost:8787/token -H 'Content-Type: application/json' \
  -d '{"grant_type":"refresh_token","refresh_token":"x"}'
```
