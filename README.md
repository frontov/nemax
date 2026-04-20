# family-chat

Docker-first monorepo for a family chat application with a Next.js frontend, NestJS API, Prisma/PostgreSQL persistence, Socket.IO realtime delivery, Redis/BullMQ notifications, MinIO storage scaffolding, and Nginx fronting the local stack.

## Stack

- `pnpm` workspace
- `turbo` monorepo
- `Next.js` + TypeScript in `apps/web`
- `NestJS` + TypeScript in `apps/api`
- Prisma + PostgreSQL
- Redis + BullMQ
- Web Push
- MinIO
- Nginx
- Docker Compose

## Current MVP

- Create family
- Session-cookie auth with `HttpOnly` cookie storage
- Server-side session invalidation on logout
- Create, validate, and join invites
- Atomic invite consume on join
- Load and send chat messages
- Mark messages as read
- Realtime `message.created` and `messages.read`
- List members and devices
- Revoke a device
- Remove a member and revoke their family-scoped sessions/devices
- Save notification settings
- Register and revoke Web Push subscriptions
- Queue-backed notification delivery with retry
- Dedicated worker process for notifications
- Audit log writes for critical actions
- Redis-backed rate limiting for hot endpoints

## Repository Layout

```text
apps/
  api/
  web/
packages/
  config/
  shared/
  ui/
infra/
  minio/
  nginx/
scripts/
docs/
```

## Getting Started

1. Copy the environment file:

```bash
cp .env.example .env
```

2. Build and run the stack:

```bash
docker compose up --build
```

3. Open the services:

- App: `http://localhost:8080`
- Admin page: `http://localhost:8080/admin`
- API health via Nginx: `http://localhost:8080/api/health`
- MinIO console: `http://localhost:9001`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

## Product Flows

- Main page `/` is now intentionally minimal for regular family members:
  - if the user already has an active session cookie, the page opens the chat directly
  - if the user is not logged in, the page shows a single field for the invite code
- Invite login flow:
  - enter the invite code on `/`
  - continue to `/join/<code>`
  - confirm the join form and the backend creates the member, device, and session
  - after successful join, the app redirects the user back to `/`, where the active session opens the chat automatically
- Admin flow:
  - all setup and management actions are grouped under `/admin`
  - from there you can open family creation, invite generation, members, devices, notifications, and chat
  - invite generation now also shows a direct join link and a QR code for mobile sign-in

## Docker Notes

- `api` runs migrations before startup.
- `worker` runs BullMQ notification processing separately from the HTTP API.
- Docker healthchecks are configured for `web`, `api`, `redis`, `minio`, `postgres`, and `nginx`.
- Nginx proxies browser traffic to the web app and forwards `/api/*` and `/ws` to the API service.

## Seed Data

- Demo seed is idempotent.
- Demo seed does **not** run automatically in local Docker startup.
- Run it explicitly when needed:

```bash
pnpm --filter @family-chat/api seed
```

- Set `DEMO_SEED=false` to disable demo seeding entirely.
- The demo session token printed by the seed script is intended only for local development.

## Useful Commands

```bash
docker compose down -v
pnpm install
pnpm build
pnpm --filter @family-chat/api prisma:generate
pnpm --filter @family-chat/api prisma:migrate:dev
pnpm --filter @family-chat/api seed
pnpm --filter @family-chat/api test
pnpm --filter @family-chat/api test:e2e
```

## E2E Notes

- `test` runs the fast in-memory integration suite.
- `test:e2e` is intended for a real environment with PostgreSQL and Redis.
- Set `RUN_E2E=true` together with real `DATABASE_URL` and `REDIS_URL` to execute the websocket/queue/push scenario.

## Hardening Notes

- Realtime auth uses the session cookie during the Socket.IO handshake.
- Family room subscriptions are checked against active memberships before join.
- Notification delivery currently focuses on message notifications and respects `pushEnabled` and `muteUntil`.
- Rate limiting is now Redis-backed, but still keyed primarily by IP/path and can be refined further with user-aware policies.
