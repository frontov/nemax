FROM node:24-alpine AS base

ARG NEXT_PUBLIC_APP_URL="http://localhost:8080"
ARG NEXT_PUBLIC_API_URL="http://localhost:8080/api"
ARG NEXT_PUBLIC_WS_URL="http://localhost:8080"
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=""

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY

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
