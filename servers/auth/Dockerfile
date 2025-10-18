FROM oven/bun:alpine AS builder

WORKDIR /app

# Copy only the auth server files
COPY servers/auth/package.json ./
COPY servers/auth/src ./src

# Install only production dependencies
RUN bun install --production

FROM oven/bun:alpine AS runner

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 hono

# Copy only what we need
COPY --from=builder --chown=hono:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=hono:nodejs /app/src ./src
COPY --from=builder --chown=hono:nodejs /app/package.json ./package.json

USER hono
EXPOSE 8080

CMD ["bun", "src/index.ts"]