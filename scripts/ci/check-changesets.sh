#!/bin/bash
# Fails a pull request that changes what core or an app is built from without a
# changeset naming it. Its version comes from changesets, and its image from its
# version, so without one the change never reaches dev or prod.
#
# A shared package counts through every deployable that uses it (turbo's graph),
# and infra/web through every app image. Tests, Markdown and the changesets
# themselves do not count. A release PR, which consumes changesets, passes.
# Files outside any workspace (root dependencies, CI) are not checked: name the
# apps they should reach in a changeset yourself.
#
#   bun run check:changesets <base commit>      (turbo must be on PATH)
set -euo pipefail
base=$(git rev-parse --verify "${1:?usage: check-changesets.sh <base commit>}^{commit}")
deployables=" @servers/core @apps/auth @apps/admin @apps/workspace @domains/engineering "
apps=(@apps/auth @apps/admin @apps/workspace @domains/engineering)
changesets() { git diff --name-only "--diff-filter=$1" "$base" HEAD -- .changeset | grep -E '\.md$' | grep -v '^\.changeset/README\.md$' || true; }

if [[ -n $(changesets D) ]]; then echo "Consumes changesets: a release PR."; exit 0; fi

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
missing=()
for name in $(printf '%s\n' ${reached[@]+"${reached[@]}"} | sort -u); do
  [[ $deployables == *" $name "* && $named != *" $name "* ]] && missing+=("$name")
done
if ((${#missing[@]})); then
  echo "::error::This change reaches ${missing[*]}, but no changeset in it names them. Run \`bun run changeset\` and select them, so each gets a new version and image."
  exit 1
fi
echo "Changesets cover every deployable this change reaches."
