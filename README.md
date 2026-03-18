# @opengather/web

React Router application that contains both:

- frontend UI routes
- server-side loaders/actions for instance business logic

## Getting Started

Use a Prisma 7-compatible Node version:

```bash
nvm use
```

1. Copy the local env file:
   ```bash
   cp .env.example .env
   ```
2. Start the local database from the workspace root if you are using Docker for Postgres:
   ```bash
   docker compose up -d opengather-db
   ```
3. Ensure env vars are set (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `HUB_BASE_URL`).
   Default Compose DB URL: `postgres://opengather:opengather@127.0.0.1:5433/opengather`.
   Hub URL: `http://127.0.0.1:9000`.
4. Start dev server:
   ```bash
   npm run dev
   ```
5. Open http://localhost:5173

## E2E Tests (Playwright)

```bash
npm run test:e2e
```

The default test database URL targets the Docker Compose database on `127.0.0.1:5433`.

Test runtime rule:
- Keep the app test port at `5173`.
- If Playwright startup conflicts with `5173`, assume an existing local dev server is already running and reuse it (do not change ports).

## Authentication

- better-auth client: `app/lib/auth-client.ts`
- better-auth server handler route: `/api/auth/*`
- Google OAuth is handled by `better-auth` social provider config (when configured in the app database)

## Pages

- `/` - Home page with setup and session status
- `/login` - Sign in page
- `/register` - Sign up page
- `/setup` - First-run single-tenant setup wizard
  - includes initial admin account creation
- `/feed` - Default server feed (posts, replies, semantic search, moderation controls)
- `/community` - Legacy alias to `/feed`
- `/profile` - Signed-in profile activity feed (posts and actions)
- `/settings` - Personal profile/account settings
- `/server-settings` - Server-level settings for admins
- `/audit-logs` - Admin-only audit log review page
- `/auth/hub/login` - Start Hub OIDC login
- `/auth/hub/callback` - Hub OIDC callback handler

## Server Modules

Backend logic lives in `app/server/*.server.ts`.

## Structured Logging

- Logs are emitted as JSON lines (`stdout`/`stderr`) from `app/server/logger.server.ts`.
- Core fields include: `timestamp`, `level`, `event`, `requestId`, `method`, `path`, and optional `userId`.
- `X-Request-Id` is set on server-rendered and auth responses. If an incoming `x-request-id` exists, it is reused.

Local development:
- Run `npm run dev` and inspect structured logs directly in terminal output.
- Use `jq` for readability, for example: `npm run dev | jq -R 'fromjson? // .'`.

Production:
- Ship raw JSON logs from process output to your log sink/collector.
- Index at minimum `event`, `requestId`, `path`, `statusCode`, and `durationMs`.
- Alert on repeated `level=error` events and spikes in `auth.rate_limited` / `community.post.rate_limited`.

## Metrics

- Prometheus-compatible metrics endpoint: `GET /metrics`.
- Core metrics:
  - `opengather_instance_up`
  - `opengather_instance_uptime_seconds`
  - `opengather_database_up`
  - `opengather_auth_flow_total{flow,outcome}`
  - `opengather_posts_events_total{outcome}`
  - `opengather_metrics_scrape_total`

Quick scrape test:
```bash
curl -fsS http://localhost:5173/metrics
```

Detailed dashboard queries and alert thresholds:
- `OBSERVABILITY.md`

## Error Monitoring

- Error monitoring service: `app/server/error-monitoring.server.ts`.
- Captures server exceptions with:
  - request context (`requestId`, method, path)
  - tags (`environment`, `service`, `release`)
  - deduplication window
  - sampling rate
- Optional outbound delivery via webhook URL.
- High-severity events can be routed to a dedicated alert webhook URL.

Config keys (stored in `config` table):
- `error_monitoring_enabled` (boolean)
- `error_monitoring_webhook_url` (string)
- `error_monitoring_alert_webhook_url` (string)
- `error_monitoring_sample_rate` (number, `0..1`)
- `error_monitoring_dedupe_window_seconds` (number)

Controlled test event (admin only):
```bash
curl -fsS http://localhost:5173/debug/error-monitoring
```

## Backup and Recovery

- Backup/restore scripts are in `scripts/`.
- Runbook with automation, restore, and DR steps:
  - `BACKUP_RECOVERY.md`

## Deployment

Deploy the Node build output from `build/server/index.js` with the environment variables used in local development.
