#!/bin/bash
# Fails a pull request that changes what core or an app is built from without a
# changeset naming it. Its version comes from changesets, and its image from its
# version, so without one the change never reaches dev or prod.
#
# A shared package counts through every deployable that uses it (turbo's graph),
# and infra/web through every app image. Tests, Markdown and the changesets
# themselves do not count. A changeset may name only core and the apps. A release
# PR, which consumes changesets, passes if it consumes all of them.
# Files outside any workspace (root dependencies, CI) are not checked: name the
# apps they should reach in a changeset yourself.
#
#   bun run check:changesets <base commit>      (turbo must be on PATH)
set -euo pipefail
base=$(git rev-parse --verify "${1:?usage: check-changesets.sh <base commit>}^{commit}")
deployables=" @servers/core @apps/auth @apps/admin @apps/workspace @domains/engineering "
apps=(@apps/auth @apps/admin @apps/workspace @domains/engineering)
changesets() { git diff --name-only "--diff-filter=$1" "$base" HEAD -- .changeset | grep -E '\.md$' | grep -v '^\.changeset/README\.md$' || true; }

if [[ -n $(changesets D) ]]; then
  # A changeset left pending keeps its apps on an alpha, so their released version
  # is never built and prod cannot ship it. QA checks the PR merged into main, so
  # this also catches one that landed after the release branch was cut.
  left=$(git ls-tree --name-only HEAD .changeset/ | grep -E '\.md$' | grep -v '^\.changeset/README\.md$' || true)
  if [[ -n $left ]]; then
    echo "::error::This release leaves $(wc -l <<< "$left" | tr -d ' ') changeset(s) pending. Rebase on main and run \`bun run release:version\` again."
    exit 1
  fi
  echo "Consumes every changeset: a release PR."
  exit 0
fi

workspaces=$(turbo ls --output=json | jq -r '.packages.items[] | "\(.path)\t\(.name)"')
direct=() reached=()
while IFS= read -r file; do
  case $file in
    '' | *.md | .changeset/* | *.test.* | *.e2e.* | */e2e/* | */playwright.config.*) continue ;;
    infra/web/*) reached+=("${apps[@]}"); continue ;;
  esac
  # The workspace with the longest path that contains this file, if any.
  name=$(awk -F'\t' -v f="$file" 'index(f, $1 "/") == 1 && length($1) > best { best = length($1); name = $2 } END { print name }' <<< "$workspaces")
  [[ -z $name ]] || direct+=("--filter=...$name")
done < <(git diff --name-only "$base" HEAD)
if ((${#direct[@]})); then
  read -ra more <<< "$(turbo ls "${direct[@]}" --output=json | jq -r '[.packages.items[].name] | join(" ")')"
  reached+=(${more[@]+"${more[@]}"})
fi

named=" $(changesets AM | while IFS= read -r f; do awk '/^---$/ { n++; next } n == 1' "$f"; done \
  | sed -nE 's/^"?([^":]+)"?: *(patch|minor|major).*/\1/p' | sort -u | tr '\n' ' ') "
# Shared packages are not versioned (`ignore` in .changeset/config.json), and
# Changesets refuses a changeset that mixes them with versioned ones.
for name in $named; do
  [[ $deployables == *" $name "* ]] || {
    echo "::error::A changeset names $name, which is not versioned. Name only core and the apps it reaches."
    exit 1
  }
done
missing=()
for name in $(printf '%s\n' ${reached[@]+"${reached[@]}"} | sort -u); do
  [[ $deployables == *" $name "* && $named != *" $name "* ]] && missing+=("$name")
done
if ((${#missing[@]})); then
  echo "::error::This change reaches ${missing[*]}, but no changeset in it names them. Run \`bun run changeset\` and select them, so each gets a new version and image."
  exit 1
fi
echo "Changesets cover every deployable this change reaches."
