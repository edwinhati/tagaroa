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

FROM caddy:2.11.9-alpine@sha256:0bbb055bda6793c999bde78b1b5ce3e89f829fb031af2cf50056ea1246559fee
ARG APP
ARG APP_PATH=""
ENV APP_PATH=$APP_PATH
COPY infra/web/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /csp /etc/caddy/csp
COPY --from=build /repo/$APP/dist/client /srv$APP_PATH
EXPOSE 80
