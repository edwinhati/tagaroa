#!/bin/sh
# Registers on first start (RUNNER_TOKEN is a one-hour registration token),
# keeping the credentials in /config so a recreated container reuses them.
set -eu
cd /home/runner
if [ ! -f /config/.runner ]; then
  : "${RUNNER_TOKEN:?first start needs a registration token}"
  ./config.sh --unattended --replace \
    --url "https://github.com/${RUNNER_REPO:-edwinhati/tagaroa}" \
    --token "$RUNNER_TOKEN" \
    --name "${RUNNER_NAME:-tagaroa-dev-server}" \
    --labels self-hosted,tagaroa
  cp .runner .credentials .credentials_rsaparams /config/
else
  cp /config/.runner /config/.credentials /config/.credentials_rsaparams .
fi
exec ./run.sh
