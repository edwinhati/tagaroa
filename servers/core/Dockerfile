# Build context is the repo root: docker build -f servers/core/Dockerfile .
# The build stage always runs on the builder's own platform; the JS it emits and
# the pure-JS production dependencies are platform-independent, so only the
# runtime stage is assembled for the target.
FROM --platform=$BUILDPLATFORM oven/bun:1.4.2@sha256:9114c058aeae42162ee16dd5084b95fe9473970bb6bcb5b232ab1630f0546895 AS build
WORKDIR /repo
# The root `prepare` script installs git hooks unless CI is set.
ENV CI=1
COPY . .
RUN bun install --frozen-lockfile
RUN cd servers/core && bun run build
# ponytail: production install runs on the build platform; if a dependency ever
# ships a native binary, pass --cpu/--os here from TARGETARCH.
RUN rm -rf node_modules servers/core/node_modules \
 && bun install --frozen-lockfile --production --filter @servers/core

FROM oven/bun:1.4.2-slim@sha256:cb3bbbb08e13a4a2ff400f24c7a2a1d5efa83f6ef8544d52d95a519631e2fc61
ENV NODE_ENV=production
WORKDIR /repo/servers/core
COPY --from=build --chown=bun:bun /repo/node_modules /repo/node_modules
COPY --from=build --chown=bun:bun /repo/packages/contracts /repo/packages/contracts
COPY --from=build --chown=bun:bun /repo/packages/email /repo/packages/email
COPY --from=build --chown=bun:bun /repo/servers/core/node_modules ./node_modules
COPY --from=build --chown=bun:bun /repo/servers/core/package.json ./package.json
COPY --from=build --chown=bun:bun /repo/servers/core/dist ./dist
COPY --from=build --chown=bun:bun /repo/servers/core/drizzle ./drizzle
COPY --from=build --chown=bun:bun /repo/servers/core/scripts ./scripts
COPY --from=build --chown=bun:bun /repo/servers/core/src ./src
USER bun
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD bun -e "fetch('http://127.0.0.1:8080/api/health/live').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["bun", "dist/main.js"]
