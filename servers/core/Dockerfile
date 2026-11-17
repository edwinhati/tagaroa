# Build context is the repo root: docker build -f servers/core/Dockerfile .
# The build stages always run on the builder's own platform; the JS they emit and
# the pure-JS production dependencies are platform-independent, so only the
# runtime stage is assembled for the target.
#
# Installs run on `turbo prune --docker` output, so they depend only on the
# manifests and lockfile of the workspaces core actually uses: a change anywhere
# else (docs, another app) reuses both installs from the layer cache.

# turbo prune: one tree to build core in, one with only what it runs on.
FROM --platform=$BUILDPLATFORM oven/bun:1.4.4@sha256:1d22548f177f4ff38e0c15baa3c2c46c6c2060ba2d1bc573bb4720b407548f1d AS prune
WORKDIR /repo
ENV TURBO_TELEMETRY_DISABLED=1
# turbo at the version bun.lock pins, installed before the source arrives.
COPY bun.lock /tmp/bun.lock
RUN bun add --global "$(bun -p 'require("/tmp/bun.lock").packages.turbo[0]')"
COPY . .
RUN turbo prune @servers/core --docker --out-dir /pruned/build \
 && turbo prune @servers/core --docker --production --out-dir /pruned/runtime

FROM --platform=$BUILDPLATFORM oven/bun:1.4.4@sha256:1d22548f177f4ff38e0c15baa3c2c46c6c2060ba2d1bc573bb4720b407548f1d AS build
WORKDIR /repo
# The root `prepare` script installs git hooks unless CI is set.
ENV CI=1
COPY --from=prune /pruned/build/json/ .
RUN bun install --frozen-lockfile
COPY --from=prune /pruned/build/full/ .
RUN cd servers/core && bun run build

# Only workspaces core reaches through `dependencies`; turbo rewrites the pruned
# manifests and lockfile so the frozen install still holds.
FROM --platform=$BUILDPLATFORM oven/bun:1.4.4@sha256:1d22548f177f4ff38e0c15baa3c2c46c6c2060ba2d1bc573bb4720b407548f1d AS deps
WORKDIR /repo
ENV CI=1
COPY --from=prune /pruned/runtime/json/ .
# ponytail: production install runs on the build platform; if a dependency ever
# ships a native binary, pass --cpu/--os here from TARGETARCH.
RUN bun install --frozen-lockfile --production
# TypeScript arrives only as a peer dependency of @thallesp/nestjs-better-auth,
# which never loads it; core runs compiled JS. Its native `tsc` embeds Go's
# golang.org/x/text, which image scanners flag. `--omit=peer` would also drop
# react-dom, which email rendering needs, so remove just these.
RUN rm -rf node_modules/.bun/typescript@* node_modules/.bun/@typescript+* \
 && find node_modules -xtype l -delete
COPY --from=prune /pruned/runtime/full/ .

# Distroless: Bun, glibc and CA certificates, with no shell or OS packages to patch.
FROM oven/bun:1.4.4-distroless@sha256:153a951ae40106e125898103e6e990ee0f38e6aee7f561029e26cf9fbed23470
# Its entrypoint is bun; cleared so commands name bun themselves, as deploys and
# onboarding run them (`bun dist/migrate.js`, `bun scripts/bootstrap-admin.ts`).
ENTRYPOINT []
ENV NODE_ENV=production
WORKDIR /repo/servers/core
COPY --from=deps --chown=nonroot:nonroot /repo/node_modules /repo/node_modules
COPY --from=deps --chown=nonroot:nonroot /repo/packages/contracts /repo/packages/contracts
COPY --from=deps --chown=nonroot:nonroot /repo/packages/email /repo/packages/email
COPY --from=deps --chown=nonroot:nonroot /repo/servers/core/node_modules ./node_modules
COPY --from=deps --chown=nonroot:nonroot /repo/servers/core/package.json ./package.json
COPY --from=build --chown=nonroot:nonroot /repo/servers/core/dist ./dist
COPY --from=deps --chown=nonroot:nonroot /repo/servers/core/drizzle ./drizzle
COPY --from=deps --chown=nonroot:nonroot /repo/servers/core/scripts ./scripts
COPY --from=deps --chown=nonroot:nonroot /repo/servers/core/src ./src
USER nonroot
EXPOSE 8080
# Exec form: there is no shell to run a string.
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD ["bun", "-e", "fetch('http://127.0.0.1:8080/api/health/live').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["bun", "dist/main.js"]
