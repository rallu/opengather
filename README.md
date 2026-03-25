# OpenGather

OpenGather is a self-hosted, privacy-first distributed social network designed to be easy to install and easy to run for real communities.

## ONCE Install

An ONCE install script is coming soon.

The repository already includes an ONCE-compatible container image so the deployment path is ready while the install script is being finalized.

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

Build and run it locally:

```bash
docker build -t opengather-once .
docker run --rm -p 8080:80 -v opengather-storage:/storage opengather-once
```

Optional environment variables for the ONCE image:

- `DATABASE_URL` if you want to use an external Postgres instance
- `BETTER_AUTH_SECRET` or `SECRET_KEY_BASE` for auth signing
- `APP_BASE_URL` when running behind a reverse proxy
- `HUB_BASE_URL` only if you want to enable optional Hub integration
- `INTERNAL_POSTGRES_DB`
- `INTERNAL_POSTGRES_USER`
- `INTERNAL_POSTGRES_PASSWORD`

The setup flow respects forwarded headers and `APP_BASE_URL`, so reverse-proxied installs can persist the public HTTPS origin correctly.

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

   `HUB_BASE_URL` is optional and only needed when you want Hub integration enabled in the UI.

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
