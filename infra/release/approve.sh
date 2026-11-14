#!/bin/bash
# Approves the open release brief and starts the release. This is the only way a
# release starts: release-prod.yml has no schedule, so setting the brief to In
# Progress in Multica by hand approves it but releases nothing until this runs
# (or someone dispatches the workflow).
#
#   bash infra/release/approve.sh [--yes]
#
# Needs `multica` logged in as the brief's assignee and `gh` logged in to GitHub.
# release.sh still checks everything (assignee, sha on main, QA green) before it
# deploys; this only saves the wait.
set -euo pipefail
project=${MULTICA_PROJECT_ID:-2e3066f3-2cc4-4521-8444-729703e51986}
repo=${GITHUB_REPOSITORY:-edwinhati/tagaroa}

briefs=$(multica issue list --status todo --project "$project" --limit 100 --output json \
  | jq -c '[.issues[] | select(any(.labels[]?; .name=="release"))]')
count=$(jq length <<< "$briefs")
if [[ $count == 0 ]]; then echo "No open release brief to approve." >&2; exit 1; fi
if [[ $count != 1 ]]; then echo "Found $count open release briefs; approve one in Multica instead." >&2; exit 1; fi
id=$(jq -r '.[0].id' <<< "$briefs")
title=$(jq -r '.[0].title // .[0].id' <<< "$briefs")

if [[ ${1:-} != --yes ]]; then
  read -r -p "Approve \"$title\" and release now? [y/N] " answer
  [[ $answer == [yY] ]] || { echo "Not approved."; exit 1; }
fi
multica issue status "$id" in_progress >/dev/null
echo "Approved \"$title\"."
gh workflow run release-prod.yml --repo "$repo" --ref main
echo "Release started: https://github.com/$repo/actions/workflows/release-prod.yml"
