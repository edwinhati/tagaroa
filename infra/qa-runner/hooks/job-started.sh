#!/bin/sh
# This runner exists for the QA workflow and nothing else. Isolation, not this
# hook, is what makes pull request code safe here: a pull request can rename a
# workflow. The hook only stops other workflows from landing here by mistake.
if [ "${GITHUB_WORKFLOW:-}" != QA ]; then
  echo "Refusing job: workflow '${GITHUB_WORKFLOW:-}' may not run on the QA runner." >&2
  exit 1
fi
