# Use Bun's official Alpine-based image
FROM oven/bun:alpine AS base

WORKDIR /app

# Optional: install turbo if Bun doesn't support it natively
RUN bun add -g turbo

COPY . .

# Prune the monorepo for the target workspace ("investment")
RUN turbo prune --scope=investment --docker

# Builder stage
FROM oven/bun:alpine AS builder
WORKDIR /app

# Installer stage
FROM base AS installer
WORKDIR /app

# Add lockfile and package.json files for dependencies
COPY --from=base /app/out/json/ .

# Install dependencies using Bun
RUN bun install --ignore-scripts

# Set environment variables as ARGs
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_AUTH_APP_URL
ARG NEXT_PUBLIC_DASHBOARD_APP_URL
ARG PORT=3005
ARG HOSTNAME="0.0.0.0"

# Make them available as environment variables
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_AUTH_APP_URL=${NEXT_PUBLIC_AUTH_APP_URL}
ENV NEXT_PUBLIC_DASHBOARD_APP_URL=${NEXT_PUBLIC_DASHBOARD_APP_URL}
ENV PORT=${PORT}
ENV HOSTNAME=${HOSTNAME}

ENV NODE_ENV=production

# Build the project using turbo
COPY --from=base /app/out/full/ .
RUN apk add --no-cache libc6-compat
# Build investment app using bun
WORKDIR /app/apps/investment
RUN bun run build

WORKDIR /app

# Runner stage
FROM oven/bun:alpine AS runner
WORKDIR /app

# Set non-root user
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# Copy build output
COPY --chmod=555 --from=installer --chown=nextjs:nodejs /app/apps/investment/.next/standalone ./
COPY --chmod=555 --from=installer --chown=nextjs:nodejs /app/apps/investment/.next/static ./apps/investment/.next/static

# Remove write permissions from copied resources for security (run as root)
RUN chmod -R 555 /app

# Switch to non-root user
USER nextjs

# Start the server
CMD ["bun", "apps/investment/server.js"]
