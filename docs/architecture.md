# Architecture

The first implementation pass uses a Docker-first monorepo layout with:

- `apps/web` for the Next.js application shell
- `apps/api` for the NestJS HTTP and realtime API shell
- `packages/shared` for cross-app types
- `packages/ui` for reusable UI primitives
- `packages/config` for workspace-wide config presets
- infrastructure definitions for Nginx, PostgreSQL, Redis, and MinIO

The second pass should add domain services, auth/session flows, persistence services, and real realtime message delivery.
