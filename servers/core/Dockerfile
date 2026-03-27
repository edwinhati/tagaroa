# ── Stage 1: Prune monorepo ──────────────────────────────────────────
FROM oven/bun:alpine AS pruner

WORKDIR /app

RUN bun add -g turbo

COPY . .

RUN turbo prune --scope=core-service --docker

# ── Stage 2: Install dependencies ────────────────────────────────────
FROM oven/bun:alpine AS installer

WORKDIR /app

# Copy pruned lockfile + package.json manifests
COPY --from=pruner /app/out/json/ .

# Install production + dev dependencies (dev needed for nest build)
RUN bun install --frozen-lockfile --ignore-scripts

# ── Stage 3: Build ───────────────────────────────────────────────────
FROM installer AS builder

WORKDIR /app

# Copy full pruned source
COPY --from=pruner /app/out/full/ .

# Build the NestJS application
WORKDIR /app/servers/core
RUN bun run build

# Remove dev dependencies after build
WORKDIR /app
RUN bun install --frozen-lockfile --production --ignore-scripts

# ── Stage 4: Production runner ───────────────────────────────────────
FROM oven/bun:alpine AS runner

WORKDIR /app

# Install dumb-init for proper PID 1 signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -S nestjs && adduser -S nestjs -G nestjs

# Copy production node_modules
COPY --from=builder --chown=nestjs:nestjs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nestjs /app/servers/core/node_modules ./servers/core/node_modules

# Copy compiled output
COPY --from=builder --chown=nestjs:nestjs /app/servers/core/dist ./servers/core/dist

# Copy package.json (needed for module resolution)
COPY --from=builder --chown=nestjs:nestjs /app/servers/core/package.json ./servers/core/package.json
COPY --from=builder --chown=nestjs:nestjs /app/package.json ./package.json

# Copy Drizzle migrations (for db:migrate at deploy time)
COPY --from=builder --chown=nestjs:nestjs /app/servers/core/drizzle ./servers/core/drizzle

ENV NODE_ENV=production
ENV PORT=8080

# Remove write permissions for security
RUN chmod -R 555 /app

USER nestjs

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/api || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["bun", "servers/core/dist/main.js"]
