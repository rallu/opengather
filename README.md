# OpenGather

OpenGather is a self-hosted, privacy-first distributed social network designed to be easy to install and easy to run for real communities.

## ONCE Install

[ONCE](https://github.com/basecamp/once) is simple hosting for Docker-based web apps: it installs Docker for you, keeps backups, and updates your container image on a schedule.

### Install the ONCE CLI

On the machine that will run OpenGather:

```bash
curl https://get.once.com | sh
```

### Deploy OpenGather

Use either the interactive flow or a one-liner.

- Interactive (`once` TUI): Run `once`, choose to install a custom image, and enter `ghcr.io/rallu/opengather`. When prompted, use the hostname that already points at this machine (DNS should resolve to it before you start the TUI).

- Localhost: deploy to localhost with:

```bash
once deploy ghcr.io/rallu/opengather
```

After a localhost deploy, the app is usually served at [opengather.localhost](http://opengather.localhost). If you configured a public hostname in the TUI, use that URL instead.

You can set `APP_BASE_URL` to that origin in the container environment (recommended for reverse proxies and fixed hostnames). If you omit it, complete [first-run setup](#custom-installation) in the browser at the URL you intend to use; the app stores that origin and uses it for auth and links. See the ONCE-Compatible Container subsection under [Custom Installation](#custom-installation).

## What OpenGather Is

OpenGather is built for communities that want their own space without handing ownership of their conversations, moderation, and member data to a centralized platform.

The project is aimed at:

- self-hosted community networks
- privacy-first deployments
- local ownership of data and moderation rules
- simple operations for small groups and independent operators

The longer-term network model is distributed rather than single-platform. Individual OpenGather deployments can remain autonomous while still participating in a broader ecosystem over time.

OpenGather Hub exists as optional ecosystem infrastructure for identity and discovery, but it is not required for a public open-source deployment of this repo.

## Custom Installation

### ONCE-Compatible Container

This repository includes an ONCE-compatible image that:

- serves HTTP on port `80`
- exposes a health endpoint at `GET /up`
- stores mutable data under `/storage`
- boots an internal Postgres instance automatically when `DATABASE_URL` is not set

Build and run it locally (set `APP_BASE_URL` to the URL you open in the browser; with `-p 8080:80` that is `http://localhost:8080`):

```bash
docker build -t opengather-once .
docker run --rm -p 8080:80 \
  -e APP_BASE_URL=http://localhost:8080 \
  -v opengather-storage:/storage \
  opengather-once
```

**`APP_BASE_URL`** — Optional but recommended. When set, it overrides the stored setup URL. Canonical origin: scheme, host, and port if it is not the default for that scheme (no trailing slash). Use your real public URL in production (for example `https://gather.example.com`). For ONCE installs, set it to the hostname you configured (for example `https://gather.example.com` or `http://opengather.localhost`) if it should differ from what you confirm during setup. Behind a reverse proxy, setting this to the public HTTPS URL clients use avoids relying on proxy headers alone.

If you leave it unset, the origin from first-run setup is written to `$STORAGE_ROOT/app-base-url` (default `./storage/app-base-url` in development, `/storage/app-base-url` in the ONCE image) and read synchronously at runtime. `APP_BASE_URL` still overrides that file when set.

Optional environment variables for the ONCE image:

- `DATABASE_URL` if you want to use an external Postgres instance
- `BETTER_AUTH_SECRET` or `SECRET_KEY_BASE` for auth signing
- `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` if you want to provide your own web-push keys instead of letting ONCE generate and persist them under `/storage/vapid.env`
- `VAPID_SUBJECT` to override the default web-push subject (`APP_BASE_URL` when set, otherwise `mailto:admin@localhost`)
- `HUB_BASE_URL` only if you want to enable optional Hub integration
- `INTERNAL_POSTGRES_DB`
- `INTERNAL_POSTGRES_USER`
- `INTERNAL_POSTGRES_PASSWORD`

### Manual Node Installation

Use a Prisma 7-compatible Node version:

```bash
nvm use
```

1. Copy the local env file.

   ```bash
   cp .env.example .env
   ```

2. Set at least:

   - `DATABASE_URL`
   - `BETTER_AUTH_SECRET`

   `APP_BASE_URL` is optional if you will finish first-run setup in the browser at your real URL (the setup flow saves it). For local development on the default Vite port, set `APP_BASE_URL=http://localhost:5173` so behavior matches the address bar before setup.

   `HUB_BASE_URL` is optional and only needed when you want Hub integration enabled in the UI.

   Browser push notifications also need VAPID keys. ONCE generates them automatically on first boot. For manual/self-hosted installs, generate them once and add them to `.env`:

   ```bash
   npx web-push generate-vapid-keys
   ```

   Then copy the generated values into:

   ```bash
   VAPID_PUBLIC_KEY=...
   VAPID_PRIVATE_KEY=...
   ```

   `VAPID_SUBJECT` is optional. If you omit it, OpenGather uses `APP_BASE_URL` when available, otherwise `mailto:admin@localhost`.

3. Start Postgres. From the workspace root, the default local database is:

   ```bash
   docker compose up -d opengather-db
   ```

   Default Compose DB URL:
   `postgres://opengather:opengather@127.0.0.1:5433/opengather`

4. Start the app:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:5173](http://localhost:5173).


## Seeded Test Environment

You can populate a local OpenGather instance with predictable demo data using:

```bash
npm run seed:test-environment
```

This script assumes setup is already complete at `/setup`, then creates/ensures:

- 5 predefined users
- 10 root posts
- per-post reply threads ranging from 0 to 20 replies

All seeded accounts use password `OpenGather123!`:

- `alex@opengather.test`
- `jordan@opengather.test`
- `sam@opengather.test`
- `taylor@opengather.test`
- `morgan@opengather.test`

The script is idempotent for its own records, so you can rerun it to refresh seeded posts/replies without affecting unrelated data.

## Development

Chrome DevTools automatic workspaces are available in local development at `/.well-known/appspecific/com.chrome.devtools.json`, so DevTools can offer a workspace connection when you open the app on `localhost`.

Core commands:

```bash
npm run lint
npm run test:unit
npm run test:e2e
npm run build
```

The default Playwright test database URL targets the Docker Compose database on `127.0.0.1:5433`.

Test runtime rule:

- Keep the app test port at `5173`.
- If Playwright startup conflicts with `5173`, assume an existing local dev server is already running and reuse it.

Useful project areas:

- `app/server/*.server.ts` for backend logic
- `app/routes/*` for route loaders, actions, and UI
- `scripts/once-entrypoint.sh` for ONCE container boot logic
- `OBSERVABILITY.md` for metrics and monitoring guidance
- `BACKUP_RECOVERY.md` for backup and restore operations

Structured logging, metrics, error monitoring, and backup tooling are already included in the app for self-hosted operations.

## Web Push Notifications

OpenGather now supports browser push notifications for in-app notifications such as mentions, replies, and approval requests.

Push delivery has two requirements:

- the user enables the `Push` notification channel in their profile
- the user registers at least one browser/device subscription from the profile page

For ONCE installs, VAPID keys are generated automatically on first boot and persisted at `/storage/vapid.env` unless you provide your own. For manual installs, generate them yourself with `npx web-push generate-vapid-keys` and place them in `.env`.

The service worker is built with Google Workbox as part of `npm run build`.
