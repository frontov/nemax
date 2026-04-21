FROM node:24-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/web ./apps/web

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @family-chat/web build
RUN mkdir -p apps/web/.next/standalone/apps/web/.next/static \
  && cp -R apps/web/.next/static/. apps/web/.next/standalone/apps/web/.next/static/ \
  && cp -R apps/web/public apps/web/.next/standalone/apps/web/public

EXPOSE 3000

USER node

CMD ["node", "apps/web/.next/standalone/apps/web/server.js"]
