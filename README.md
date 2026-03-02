# @opengather/web

React Router application that contains both:

- frontend UI routes
- server-side loaders/actions for instance business logic

## Getting Started

Use a Prisma 7-compatible Node version:

```bash
nvm use
```

1. Ensure env vars are set (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `HUB_BASE_URL`).
   Default local DB URL: `postgres://opengather:opengather@localhost:5432/opengather`.
2. Start dev server:
   ```bash
   npm run dev
   ```
3. Open http://localhost:5173

## E2E Tests (Playwright)

```bash
npm run test:e2e
```

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
- `/auth/hub/login` - Start Hub OIDC login
- `/auth/hub/callback` - Hub OIDC callback handler

## Server Modules

Backend logic lives in `app/server/*.server.ts`.

## Deployment

Deploy Node build output from `build/server/index.js`.
