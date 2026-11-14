#!/bin/bash
# Runs check-changesets.sh against one-commit changes in a scratch worktree.
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
command -v "$root/node_modules/.bin/turbo" >/dev/null || { echo "check-changesets test: run bun install first" >&2; exit 1; }
tmp=$(mktemp -d)
out=$(mktemp)
git -C "$root" worktree add -q --detach "$tmp" HEAD
trap 'git -C "$root" worktree remove --force "$tmp"; rm -f "$out"' EXIT
cd "$tmp"
export PATH="$root/node_modules/.bin:$PATH"

# Commits the working tree, runs the check against its parent, then undoes it.
expect() { # pass|fail description
  git add -A
  git -c user.name=t -c user.email=t@t.invalid commit -q --no-verify -m probe
  if bash "$root/scripts/ci/check-changesets.sh" HEAD^1 > "$out" 2>&1; then got=pass; else got=fail; fi
  git reset -q --hard HEAD^1
  [[ $got == "$1" ]] || { echo "FAIL: $2: expected $1, got $got"; cat "$out"; exit 1; }
  # A failure must be the check's verdict, not a crash.
  [[ $got == pass ]] || grep -q '^::error::' "$out" || { echo "FAIL: $2: no verdict"; cat "$out"; exit 1; }
}
changeset() { printf -- '---\n%s\n---\n\nProbe.\n' "$1" > .changeset/zz-probe.md; }

echo '// probe' >> apps/auth/src/lib/forms.ts
expect fail "an app source change without a changeset"
echo '// probe' >> apps/auth/src/lib/forms.ts
changeset '"@apps/auth": patch'
expect pass "an app source change with its changeset"
echo '// probe' >> packages/contracts/src/directory.ts
changeset '"@apps/auth": patch'
expect fail "a shared package change that names only one of its apps"
echo '// probe' >> apps/auth/src/lib/forms.test.ts
echo probe >> apps/auth/README.md
expect pass "tests and Markdown only"
echo '# probe' >> infra/web/Caddyfile
changeset '"@apps/auth": patch'
expect fail "a web image change that misses three apps"
git rm -q "$(git ls-files '.changeset/*.md' | grep -v README.md | head -1)"
echo '// probe' >> apps/auth/src/lib/forms.ts
expect pass "a release PR"
echo 'PASS: changesets must name every app or core a change reaches'
