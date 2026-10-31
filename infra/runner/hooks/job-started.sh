#!/bin/sh
# The Docker socket is root on CT 105, so only trusted code may run here: a
# pull request (even one that edits a workflow to `runs-on: self-hosted`) never.
# A non-zero exit fails the job before any step starts.
case "${GITHUB_EVENT_NAME:-}" in
  push | workflow_run | workflow_dispatch | schedule) ;;
  *) echo "Refusing job: event '${GITHUB_EVENT_NAME:-}' may not run on this runner." >&2; exit 1 ;;
esac
if [ "${GITHUB_REF:-}" != "refs/heads/main" ]; then
  echo "Refusing job: ref '${GITHUB_REF:-}' is not refs/heads/main." >&2
  exit 1
fi
