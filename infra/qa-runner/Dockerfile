# Sandboxed self-hosted runner for QA only: pull request code runs here, so it
# has no Docker socket, no host directories, no secrets and no sudo.
# Build from the repo root's infra/qa-runner (compose.yml does this):
#   docker compose --env-file .env up -d --build
FROM oven/bun:1.4.4@sha256:1d22548f177f4ff38e0c15baa3c2c46c6c2060ba2d1bc573bb4720b407548f1d AS bun

FROM ghcr.io/actions/actions-runner:2.338.2@sha256:6d0b2d80d80f143f77dcb676e50920100bbb547e39e883454d57f45ab8c31300
# Match apps/*/package.json's @playwright/test, so install-deps installs the
# system libraries that version's browsers need.
ARG PLAYWRIGHT_VERSION=1.64.1
USER root
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
# pg_dump/pg_restore must be at least the sidecar's major version (18), which
# Ubuntu does not ship, so they come from the PostgreSQL project's repository.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl git gnupg jq lsb-release shellcheck unzip xz-utils \
 && install -d /usr/share/postgresql-common/pgdg \
 && curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc \
 && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends postgresql-client-18 \
 && bunx playwright@${PLAYWRIGHT_VERSION} install-deps chromium firefox webkit \
 && rm -rf /var/lib/apt/lists/* /root/.bun \
 && apt-get purge -y sudo \
 && mkdir -p /config /home/runner/_work \
 && chown -R runner /home/runner /config \
 && chmod 700 /config
COPY --chmod=755 hooks/job-started.sh /home/runner/hooks/job-started.sh
COPY --chmod=755 entrypoint.sh /entrypoint.sh
ENV ACTIONS_RUNNER_HOOK_JOB_STARTED=/home/runner/hooks/job-started.sh
USER runner
WORKDIR /home/runner
ENTRYPOINT ["/entrypoint.sh"]
