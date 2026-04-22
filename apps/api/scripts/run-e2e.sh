#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$API_DIR/../.." && pwd)"

cleanup() {
  cd "$ROOT_DIR"
  docker compose stop postgres redis minio >/dev/null 2>&1 || true
}

trap cleanup EXIT

cd "$ROOT_DIR"
docker compose up -d postgres redis minio

for _ in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U family_chat -d family_chat >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

for _ in $(seq 1 30); do
  if docker compose exec -T redis redis-cli ping >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:9000/minio/health/live" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

COMMON_ENV=(
  "DATABASE_URL=postgresql://family_chat:family_chat@127.0.0.1:5432/family_chat?schema=public"
  "REDIS_URL=redis://127.0.0.1:6379"
  "MINIO_ENDPOINT=127.0.0.1"
  "MINIO_PORT_INTERNAL=9000"
  "MINIO_USE_SSL=false"
  "MINIO_ACCESS_KEY=minioadmin"
  "MINIO_SECRET_KEY=minioadmin"
  "MINIO_BUCKET=family-chat"
  "MINIO_PUBLIC_URL=http://127.0.0.1:9000"
  "RUN_E2E=true"
)

cd "$API_DIR"
env "${COMMON_ENV[@]}" pnpm prisma:migrate:deploy
env "${COMMON_ENV[@]}" jest --config ./test/jest.e2e.config.cjs
