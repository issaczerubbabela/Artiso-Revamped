# Deploying Artiso (free) and using it on every device

Artiso is a static web app (`apps/web`, `output: 'export'`) plus the Supabase
project you already have. Hosting the static files is free on any static host;
Supabase's free tier covers auth, the database and image storage. One URL then
serves your phone, laptop and iPad, and signing in with the same account syncs
projects between them.

## 1. Host the web app on Cloudflare Pages (recommended)

Unlimited bandwidth on the free plan, and it reads `apps/web/public/_headers`
(which keeps the service worker revalidating on every deploy).

1. <https://dash.cloudflare.com> → **Workers & Pages** → **Create** → **Pages**
   → **Connect to Git** → choose `Artiso-Revamped`.
2. Build settings:

   | Setting | Value |
   | --- | --- |
   | Production branch | `master` |
   | Framework preset | None |
   | Build command | `pnpm install --frozen-lockfile && pnpm turbo run build --filter=web` |
   | Build output directory | `apps/web/out` |

3. Environment variables (Production *and* Preview) — the same values as your
   local `.env`, which is git-ignored and therefore not in the repo:

   | Variable | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | your project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon (public) key |
   | `NODE_VERSION` | `20` |

   The anon key is designed to be public; row-level security is what protects
   the data. Never put the `service_role` key here.
4. **Save and Deploy.** You get `https://<name>.pages.dev`. Every push to
   `master` redeploys.

**Created a Worker instead of a Pages project?** That works too (Cloudflare's
newer flow: Workers & Pages → Create → *Import a repository*). Use the same
build command and variables; leave the deploy command as `npx wrangler deploy`.
It reads [`wrangler.jsonc`](../wrangler.jsonc) at the repo root, which serves
`apps/web/out` as static assets — its `name` must match the Worker's name in the
dashboard. The URL is `https://<name>.<your-subdomain>.workers.dev`.

**Vercel instead?** Import the repo, set *Root Directory* to `apps/web`, leave
the Next.js preset, set the same two `NEXT_PUBLIC_*` variables. (`_headers` is
ignored there; the app still works.)

## 2. Point Supabase Auth at the new URL

Supabase → **Authentication** → **URL Configuration**:

- **Site URL**: `https://<name>.pages.dev`
- **Redirect URLs**: add `https://<name>.pages.dev/**` (keep
  `http://localhost:3000/**` for development).

Without this, sign-up confirmation emails link back to `localhost`.

## 3. Install it on each device

The app is an installable web app: it launches full screen from its own icon,
works offline after the first visit, and its local data is protected from the
browser's storage clean-up.

- **iPad / iPhone** (Safari): open the URL → Share → **Add to Home Screen**.
  Always launch it from that icon. Safari deletes the data of sites you haven't
  visited in ~7 days *unless* they're on the Home Screen, and anything not yet
  synced lives only on the device.
- **Android** (Chrome): open the URL → menu → **Install app**.
- **Laptop** (Chrome / Edge): the install icon at the right of the address bar.
- Sign in with the same account on each one.

The screen stays awake while a reference is open (iOS 16.4+ / any recent
Chrome). On iOS older than 18.4 that may not work in the Home Screen app.

## Free-tier limits worth knowing

- **Supabase pauses a free project after ~7 days with no activity.** Sync then
  shows an error badge (local editing keeps working). Resume it from the
  Supabase dashboard; regular use avoids it.
- Supabase free storage is 1 GB — plenty for reference photos.
- Updates: a new deploy is downloaded in the background and takes over the next
  time the app is launched (close it fully once, or reopen it twice).

## Checking a production build locally

```sh
pnpm --filter web build
node apps/web/scripts/serve-static.mjs        # http://localhost:4173
pnpm --filter web exec playwright test -c playwright.pwa.config.ts
```
