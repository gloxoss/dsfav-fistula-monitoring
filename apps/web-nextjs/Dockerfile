# Build context is the repo root (pnpm workspace).
FROM node:24-alpine AS base
RUN npm install -g pnpm@11.10.0
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web-nextjs/package.json apps/web-nextjs/
COPY packages/shared-types/package.json packages/shared-types/
RUN pnpm install --frozen-lockfile --filter @dsfav/web...

FROM deps AS build
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY apps/web-nextjs apps/web-nextjs
RUN pnpm --filter @dsfav/web build

FROM build AS runtime
ENV NODE_ENV=production
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD wget -qO- http://localhost:3000/api/health || exit 1
CMD ["pnpm", "--filter", "@dsfav/web", "start"]
