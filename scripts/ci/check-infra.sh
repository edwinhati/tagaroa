#!/bin/bash
# Checks for everything outside the Bun workspaces, where both outages of
# 2026-11-04 started (a jq filter in infra/release/brief.sh):
#   - shellcheck on every tracked shell script
#   - actionlint on the workflows (it also shellchecks their run: blocks)
#   - every *.test.sh self-test that runs with stubs only
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

if ((${#failed[@]})); then
  printf '\nFailed: %s\n' "${failed[*]}" >&2
  exit 1
fi
printf '\nAll infra checks passed.\n'
