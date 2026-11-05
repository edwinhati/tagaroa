#!/bin/bash
# Decides which slow QA suites a change needs: core integration tests, the auth
# browser suite and the admin browser suite. Pass the commit to compare against
# (a pull request's base); with no argument every suite runs, which is what
# pushes to main, the weekly schedule and manual runs get.
#
#   bash scripts/ci/qa-scope.sh [BASE]
#
# Prints integration=, e2e_auth= and e2e_admin= lines, and appends them to
# $GITHUB_OUTPUT inside Actions. Anything it cannot classify, and any error,
# runs everything: skipping is the exception that has to be proven.
set -uo pipefail

emit() {
  local lines="integration=$1"$'\n'"e2e_auth=$2"$'\n'"e2e_admin=$3"
  printf '%s\n' "$lines"
  if [[ -n ${GITHUB_OUTPUT:-} ]]; then printf '%s\n' "$lines" >> "$GITHUB_OUTPUT"; fi
  exit 0
}
everything() { echo "Running every suite: $1" >&2; emit true true true; }

base=${1:-}
[[ -n $base ]] || everything "no base to compare against"
base_sha=$(git rev-parse --verify --quiet "$base^{commit}") || everything "$base is not in the checkout"
changed=$(git diff --name-only "$base_sha" HEAD) || everything "git diff failed"
[[ -n $changed ]] || everything "no changed files"

# Paths no suite reads. infra/docker is NOT here: the tests start its Postgres.
# Workflow files other than qa.yml run nothing in QA; qa.yml itself always runs everything.
ignored() {
  case $1 in
    *.md | docs/* | .changeset/* | .agents/* | .claude/* | hk.pkl) return 0 ;;
    infra/docker/*) return 1 ;;
    infra/*) return 0 ;;
    .github/dependabot.yml | .github/actionlint.yaml) return 0 ;;
    .github/workflows/deploy-dev.yml | .github/workflows/release-prod.yml) return 0 ;;
    scripts/ci/check-infra.sh) return 0 ;;
    *) return 1 ;;
  esac
}

workspace_changed=0
while IFS= read -r file; do
  case $file in
    apps/*/* | domains/*/* | packages/*/* | servers/*/*) workspace_changed=1 ;;
    *) ignored "$file" || everything "$file is outside the workspaces" ;;
  esac
done <<< "$changed"
[[ $workspace_changed == 1 ]] || { echo "Only files no suite reads changed." >&2; emit false false false; }

# Turborepo adds every dependent of a changed package, so a shared package marks
# each app that imports it.
turbo=$(git rev-parse --show-toplevel)/node_modules/.bin/turbo
listing=$(TURBO_TELEMETRY_DISABLED=1 TURBO_SCM_BASE=$base_sha TURBO_SCM_HEAD=HEAD \
  "$turbo" ls --affected --output=json 2>/dev/null) || everything "turbo ls --affected failed"
affected=$(sed -n '/^{/,$p' <<< "$listing" | jq -r '.packages.items[].name' 2>/dev/null) \
  || everything "could not read turbo's package list"
[[ -n $affected ]] || everything "turbo reported no affected package for a workspace change"
echo "Affected packages: $(tr '\n' ' ' <<< "$affected")" >&2

# needs NAME...: true when any named package is affected.
needs() {
  local name
  for name in "$@"; do grep -qxF "$name" <<< "$affected" && { echo true; return; }; done
  echo false
}
# Each suite's playwright.config.ts starts these servers.
emit \
  "$(needs @servers/core)" \
  "$(needs @servers/core @apps/auth @apps/workspace @domains/engineering)" \
  "$(needs @servers/core @apps/admin @apps/workspace @apps/auth)"
