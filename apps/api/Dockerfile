FROM node:26-alpine AS pruner
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g turbo
COPY . .
RUN turbo prune @nexus/api --docker

FROM node:26-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@12.9.1 --activate

# First copy dependency manifests for cached layer installation
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile

# Copy pruned source files
COPY --from=pruner /app/out/full/ .

# Production Runner using Bun for ultra-fast TypeScript execution
FROM oven/bun:1-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
ENV UV_THREADPOOL_SIZE=16

# Copy workspace and installed dependencies from builder
COPY --from=builder /app .

EXPOSE 4000

CMD ["bun", "apps/api/src/index.ts"]
