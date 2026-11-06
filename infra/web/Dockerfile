# Build context is the repo root: docker build -f infra/web/Dockerfile --build-arg VITE_...=... .
# The SPAs bake their URLs in at build time, so this image is per-environment.
FROM --platform=$BUILDPLATFORM oven/bun:1.4.4@sha256:1d22548f177f4ff38e0c15baa3c2c46c6c2060ba2d1bc573bb4720b407548f1d AS build
WORKDIR /repo
# The root `prepare` script installs git hooks unless CI is set.
ENV CI=1
COPY . .
RUN bun install --frozen-lockfile

# Every variable is passed to all four builds; an app ignores the ones it does
# not read. Values come from each app's .env.example.
ARG VITE_AUTH_BASE_URL
ARG VITE_AUTH_URL
ARG VITE_WORKSPACE_URL
ARG VITE_ADMIN_URL
ARG VITE_POST_SIGNIN_URL
ARG VITE_TRUSTED_REDIRECT_ORIGINS
ENV VITE_AUTH_BASE_URL=$VITE_AUTH_BASE_URL \
    VITE_AUTH_URL=$VITE_AUTH_URL \
    VITE_WORKSPACE_URL=$VITE_WORKSPACE_URL \
    VITE_ADMIN_URL=$VITE_ADMIN_URL \
    VITE_POST_SIGNIN_URL=$VITE_POST_SIGNIN_URL \
    VITE_TRUSTED_REDIRECT_ORIGINS=$VITE_TRUSTED_REDIRECT_ORIGINS
RUN test -n "$VITE_AUTH_BASE_URL" && test -n "$VITE_AUTH_URL" \
 && for app in apps/auth apps/admin apps/workspace domains/engineering; do \
      (cd "$app" && bun run build) || exit 1; \
    done
# The Caddyfile reads these into each app's script-src.
RUN mkdir /csp \
 && for app in apps/auth apps/admin apps/workspace domains/engineering; do \
      bun infra/web/inline-script-hashes.ts "$app/dist/client/_shell.html" > "/csp/${app#*/}" || exit 1; \
    done

FROM caddy:2.11.8-alpine@sha256:3db3a09e418f86a8fce8de4bc0026fccd2b4cd925aef00cc7d843d9fdc75e442
COPY infra/web/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /csp /etc/caddy/csp
COPY --from=build /repo/apps/auth/dist/client /srv/auth
COPY --from=build /repo/apps/admin/dist/client /srv/admin
COPY --from=build /repo/apps/workspace/dist/client /srv/workspace
COPY --from=build /repo/domains/engineering/dist/client /srv/engineering
EXPOSE 80
