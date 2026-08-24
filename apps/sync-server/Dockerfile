FROM node:20-slim AS base
RUN corepack enable

FROM base AS build
WORKDIR /repo
COPY pnpm-workspace.yaml package.json ./
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY apps/sync-server/package.json apps/sync-server/package.json
RUN pnpm install --frozen-lockfile --filter sync-server... 2>/dev/null || pnpm install --filter sync-server...
COPY packages/db packages/db
COPY packages/shared packages/shared
COPY apps/sync-server apps/sync-server
RUN pnpm build:packages
RUN pnpm --filter sync-server build

FROM base AS runtime
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo /repo
EXPOSE 1234
CMD ["node", "apps/sync-server/dist/index.js"]
