#!/bin/bash
# Checks for everything outside the Bun workspaces, where both outages of
# 2026-11-04 started (a jq filter in infra/release/brief.sh):
#   - shellcheck on every tracked shell script
#   - actionlint on the workflows (it also shellchecks their run: blocks)
#   - every *.test.sh self-test that runs with stubs only
#   - the dev wrapper's own tests (scripts/with-live.test.mjs)
#
#   bash scripts/ci/check-infra.sh      (or: bun run check:infra)
#
# Needs shellcheck and actionlint on PATH (brew install shellcheck actionlint).
set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 1

# These need built images and Docker, not stubs; run them by hand as their headers say.
needs_images=" infra/dev/images.test.sh infra/dev/browsers.test.sh "

failed=()
section() { printf '\n== %s\n' "$1"; }

section shellcheck
if command -v shellcheck >/dev/null; then
  git ls-files -z '*.sh' | xargs -0 shellcheck || failed+=(shellcheck)
else
  echo "shellcheck is not installed"; failed+=(shellcheck)
fi

section actionlint
if command -v actionlint >/dev/null; then
  actionlint || failed+=(actionlint)
else
  echo "actionlint is not installed"; failed+=(actionlint)
fi

while IFS= read -r test; do
  [[ $needs_images == *" $test "* ]] && continue
  section "$test"
  case $(head -n 1 "$test") in
    *bash*) bash "$test" ;;
    *) sh "$test" ;;
  esac || failed+=("$test")
done < <(git ls-files '*.test.sh')

section scripts/with-live.test.mjs
node --test scripts/with-live.test.mjs || failed+=(scripts/with-live.test.mjs)

# Dependabot bumps the images; CI and local installs read engines.bun.
section "bun version"
bun_version=$(node -p 'require("./package.json").engines.bun')
drift=$(git grep -hoE 'oven/bun:[0-9.]+' -- '*Dockerfile' | sort -u | grep -vx "oven/bun:$bun_version")
dev_engine=$(node -p 'require("./package.json").devEngines.packageManager.version')
[[ $dev_engine == "$bun_version" ]] || drift+="${drift:+$'\n'}devEngines.packageManager $dev_engine"
if [[ -n $drift ]]; then
  printf 'engines.bun is %s, but these use:\n%s\n' "$bun_version" "$drift"
  failed+=("bun version")
fi

if ((${#failed[@]})); then
  printf '\nFailed: %s\n' "${failed[*]}" >&2
  exit 1
fi
printf '\nAll infra checks passed.\n'
