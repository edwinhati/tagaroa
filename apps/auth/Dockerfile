# Use Bun's official Alpine-based image
FROM oven/bun:alpine AS base

WORKDIR /app

# Optional: install turbo if Bun doesn't support it natively (Turbo is a Node.js CLI tool)
RUN bun add -g turbo

COPY . .

# Prune the monorepo for the target workspace ("auth")
RUN turbo prune --scope=auth --docker

# Builder stage
FROM oven/bun:alpine AS builder
WORKDIR /app

# Installer stage
FROM base AS installer
WORKDIR /app

# Add lockfile and package.json files for dependencies
COPY --from=base /app/out/json/ .

# Install dependencies using Bun
RUN bun install

# Set environment variables as ARGs
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_DASHBOARD_APP_URL
ARG NEXT_PUBLIC_ADMIN_APP_URL
ARG PORT=3000
ARG HOSTNAME="0.0.0.0"

# Make them available as environment variables
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_DASHBOARD_APP_URL=${NEXT_PUBLIC_DASHBOARD_APP_URL}
ENV NEXT_PUBLIC_ADMIN_APP_URL=${NEXT_PUBLIC_ADMIN_APP_URL}
ENV PORT=${PORT}
ENV HOSTNAME=${HOSTNAME}

ENV NODE_ENV=production
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED=1

# Build the project using turbo
COPY --from=base /app/out/full/ .
RUN apk add --no-cache libc6-compat
# Build auth app using bun
RUN cd apps/auth && bun run build

# Runner stage
FROM oven/bun:alpine AS runner
WORKDIR /app

# Set non-root user
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
USER nextjs

# Copy build output
COPY --from=installer --chown=nextjs:nodejs /app/apps/auth/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/auth/.next/static ./apps/auth/.next/static
# COPY --from=installer --chown=nextjs:nodejs /app/apps/auth/public ./apps/auth/public

# Start the server
CMD ["bun", "apps/auth/server.js"]
