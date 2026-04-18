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

# Set environment variables as ARGs
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT
ARG NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE

# Make them available as environment variables
ENV NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN}
ENV NEXT_PUBLIC_SENTRY_ENVIRONMENT=${NEXT_PUBLIC_SENTRY_ENVIRONMENT}
ENV NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=${NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE}

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

# Install system deps and create non-root user in a single layer
RUN apk add --no-cache dumb-init curl \
  && addgroup -S nestjs \
  && adduser -S nestjs -G nestjs

# Copy production node_modules
COPY --chmod=555 --from=builder --chown=nestjs:nestjs /app/node_modules ./node_modules
COPY --chmod=555 --from=builder --chown=nestjs:nestjs /app/servers/core/node_modules ./servers/core/node_modules

# Copy compiled output
COPY --chmod=555 --from=builder --chown=nestjs:nestjs /app/servers/core/dist ./servers/core/dist

# Copy package.json (needed for module resolution)
COPY --chmod=555 --from=builder --chown=nestjs:nestjs /app/servers/core/package.json ./servers/core/package.json
COPY --chmod=555 --from=builder --chown=nestjs:nestjs /app/package.json ./package.json

# Copy internal packages (needed for workspace symlinks in node_modules)
COPY --chmod=555 --from=builder --chown=nestjs:nestjs /app/packages ./packages

ENV NODE_ENV=production
ENV PORT=8080

# Remove write permissions for security
RUN chmod -R 555 /app

USER nestjs

EXPOSE 8080

# Liveness probe — lightweight memory-only check, no DB dependency
# start-period gives NestJS + Drizzle time to fully boot before checks begin
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl --fail --silent --max-time 4 http://localhost:8080/api/health/live > /dev/null || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["bun", "servers/core/dist/main.js"]
