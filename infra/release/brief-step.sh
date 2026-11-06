#!/bin/bash
# The dev release-brief step of deploy-dev.yml. Reporting to Multica is optional here:
# a dead token, an unreachable server or a brief.sh failure must not turn a good dev
# deploy red, so this exits 0 with a warning and sets failed=true for the alert step.
# Production stays gated: without a current approved brief, release-prod.yml releases
# nothing, and release.sh still fails closed on any Multica error.
#
#   MULTICA_TOKEN=... SHA=<sha> LOG=<file> bash infra/release/brief-step.sh
set -uo pipefail
: "${SHA:?brief-step: SHA is required}" "${LOG:?brief-step: LOG is required}"

{
  multica login --token "${MULTICA_TOKEN:-}" >/dev/null &&
    bash "${BRIEF_SH:-infra/release/brief.sh}" "$SHA"
} 2>&1 | tee -a "$LOG"
rc=${PIPESTATUS[0]}

if ((rc != 0)); then
  echo "::warning::Release brief not updated (exit $rc). The dev deploy itself succeeded and production is still gated on an approved brief. See the log above."
  echo "failed=true" >> "${GITHUB_OUTPUT:-/dev/null}"
fi
exit 0
