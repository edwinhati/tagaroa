#!/bin/bash
# The dev release-brief step of deploy-dev.yml. Reporting to Multica is optional here:
# a dead token, an unreachable server or a brief.sh failure must not turn a good dev
# deploy red, so this exits 0 with a warning.
# Production stays gated: without a current approved brief, release-prod.yml releases
# nothing, and release.sh still fails closed on any Multica error.
#
#   MULTICA_TOKEN=... SHA=<sha> bash infra/release/brief-step.sh
set -uo pipefail
: "${SHA:?brief-step: SHA is required}"

multica login --token "${MULTICA_TOKEN:-}" >/dev/null &&
  bash "${BRIEF_SH:-infra/release/brief.sh}" "$SHA"
rc=$?

if ((rc != 0)); then
  echo "::warning::Release brief not updated (exit $rc). The dev deploy itself succeeded and production is still gated on an approved brief. See the log above."
fi
exit 0
