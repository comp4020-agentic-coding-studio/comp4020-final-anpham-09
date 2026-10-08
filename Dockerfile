# syntax = docker/dockerfile:1

# Node runs the TypeScript directly (type stripping, Node 24), so there is no
# build step and no emitted bundle: what runs in production is the same source
# the tests import. `tsc --noEmit` is the typecheck; it never emits.
#
# The image must serve HTTP on 0.0.0.0:$PORT (fly.toml sets PORT) and publish
# README.md at /readme/ — see spec/README.md for what's checked.

ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-slim AS base
WORKDIR /app
ENV NODE_ENV=production
ARG PNPM_VERSION=11.18.0
RUN npm install -g pnpm@$PNPM_VERSION

# --- deps: better-sqlite3 is native. A prebuilt binary usually covers
# linux/amd64, but the toolchain is here so a miss compiles instead of failing
# at boot, which is the failure that only shows up after a deploy.
FROM base AS deps
RUN apt-get update -qq \
    && apt-get install --no-install-recommends -y build-essential python-is-python3 \
    && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

# --- runtime: production deps, the source, and the README the app publishes.
FROM base
COPY --from=deps /app/node_modules /app/node_modules
COPY package.json ./
COPY src/ /app/src/
COPY README.md /app/README.md
# Served at /img/ — a missing copy here means the pictures 404 in production
# while working perfectly in development, since `pnpm dev` reads img/ straight
# off the checkout.
COPY img/ /app/img/
EXPOSE 8080
CMD ["node", "src/server.ts"]
