# One image per front end; the build context is the repo root:
#   docker build -f infra/web/Dockerfile --build-arg APP=apps/auth .
#   docker build -f infra/web/Dockerfile --build-arg APP=domains/engineering --build-arg APP_PATH=/engineering .
# No URLs are baked in: deployed, an app works them out from its own host
# (packages/shell/src/urls.ts), so the same image runs in every environment.
# The build stage runs on the build machine's platform and the runtime stage only
# copies files, so a multi-platform build needs no emulation.
FROM --platform=$BUILDPLATFORM oven/bun:1.4.4@sha256:1d22548f177f4ff38e0c15baa3c2c46c6c2060ba2d1bc573bb4720b407548f1d AS build
ARG APP
WORKDIR /repo
# The root `prepare` script installs git hooks unless CI is set.
ENV CI=1
COPY . .
RUN bun install --frozen-lockfile
RUN test -n "$APP" && cd "$APP" && bun run build
# The Caddyfile reads these into the app's script-src.
RUN bun infra/web/inline-script-hashes.ts "$APP/dist/client/_shell.html" > /csp
# Brotli copies beside each file, which the Caddyfile serves as they are.
RUN bun infra/web/precompress.ts "$APP/dist/client"

# Caddy's release binary is built with dependency versions that have known CVEs
# (golang.org/x/net, klauspost/compress), so it is rebuilt from the same release
# with the fixed versions, cross-compiled like the app build.
# ponytail: drop each --replace once a Caddy release ships that version or newer.
FROM --platform=$BUILDPLATFORM caddy:2.11.9-builder-alpine@sha256:646fee578e680989ca5c7fd1ce6f1de574d19fd71ef2221810cc0510a9f40c86 AS caddy
ARG TARGETOS
ARG TARGETARCH
# The runtime image has no OS, so it takes Alpine's MIME table (fonts, icons).
RUN apk add --no-cache mailcap
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH XCADDY_SETCAP=0 xcaddy build v2.11.9 \
      --replace golang.org/x/net=golang.org/x/net@v0.62.0 \
      --replace github.com/klauspost/compress=github.com/klauspost/compress@v1.20.2 \
      --output /caddy

# Only Caddy and the files it serves: no shell or OS packages to patch.
FROM scratch
ARG APP
ARG APP_PATH=""
ENV APP_PATH=$APP_PATH XDG_CONFIG_HOME=/config XDG_DATA_HOME=/data
COPY --from=caddy /caddy /usr/bin/caddy
COPY --from=caddy /etc/mime.types /etc/mime.types
COPY infra/web/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /csp /etc/caddy/csp
COPY --from=build /repo/$APP/dist/client /srv$APP_PATH
EXPOSE 80
CMD ["/usr/bin/caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
