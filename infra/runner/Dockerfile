# Self-hosted GitHub Actions runner for CT 105 (and nothing else).
# docker build -f infra/runner/Dockerfile --build-arg RUNNER_UID=<tagaroa uid> --build-arg DOCKER_GID=<host docker gid> infra/runner
FROM ghcr.io/actions/actions-runner:2.338.2
ARG RUNNER_UID=1001
ARG DOCKER_GID=999
ARG COMPOSE_VERSION=v5.6.1
ARG BUILDX_VERSION=v0.38.1
ARG MULTICA_VERSION=0.7.2
USER root
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl git jq openssh-client skopeo \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /usr/local/lib/docker/cli-plugins \
 && curl -fsSL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-x86_64" -o /usr/local/lib/docker/cli-plugins/docker-compose \
 && curl -fsSL "https://github.com/docker/buildx/releases/download/${BUILDX_VERSION}/buildx-${BUILDX_VERSION}.linux-amd64" -o /usr/local/lib/docker/cli-plugins/docker-buildx \
 && chmod +x /usr/local/lib/docker/cli-plugins/* \
 && curl -fsSL "https://github.com/multica-ai/multica/releases/download/v${MULTICA_VERSION}/multica-cli-${MULTICA_VERSION}-linux-amd64.tar.gz" | tar xz -C /usr/local/bin multica \
 && (getent group "${DOCKER_GID}" >/dev/null || groupadd -g "${DOCKER_GID}" hostdocker) \
 && usermod -o -u "${RUNNER_UID}" -aG "${DOCKER_GID}" runner \
 && mkdir -p /config /home/runner/_work \
 && chown -R runner /home/runner /config \
 && chmod 700 /config
COPY --chmod=755 hooks/job-started.sh /home/runner/hooks/job-started.sh
COPY --chmod=755 entrypoint.sh /entrypoint.sh
ENV ACTIONS_RUNNER_HOOK_JOB_STARTED=/home/runner/hooks/job-started.sh
USER runner
WORKDIR /home/runner
ENTRYPOINT ["/entrypoint.sh"]
