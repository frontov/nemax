FROM node:20-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/api ./apps/api

RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @family-chat/api prisma:generate
RUN pnpm --filter @family-chat/api build

EXPOSE 3001

CMD ["sh", "-c", "pnpm --filter @family-chat/api prisma:migrate:deploy && pnpm --filter @family-chat/api start"]
