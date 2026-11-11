# Build context is the repo root (pnpm workspace).
FROM node:24-alpine AS base
RUN npm install -g pnpm@11.10.0
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api-nestjs/package.json apps/api-nestjs/
RUN pnpm install --frozen-lockfile --filter @dsfav/api...

FROM deps AS build
COPY apps/api-nestjs apps/api-nestjs
RUN pnpm --filter @dsfav/api build

FROM build AS runtime
ENV NODE_ENV=production PORT=3001
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD wget -qO- http://localhost:3001/health || exit 1
CMD ["node", "apps/api-nestjs/dist/main.js"]
