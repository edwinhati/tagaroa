#!/usr/bin/env bash
set -euo pipefail

# Detect version-bumped deployable components by parsing git diff.
# Outputs: released (true/false), version (semver string)
# All debug output goes to stderr; only key=value lines go to stdout (>> $GITHUB_OUTPUT)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$REPO_ROOT"

DEPLOYABLE_PATHS=(
  "/apps/finance"
  "/apps/auth"
  "/apps/web"
  "/apps/admin"
  "/apps/investment"
  "/servers/core"
)

CHANGED_PKGS=$(git diff --name-only HEAD~1 HEAD 2>/dev/null | grep 'package.json$' | sed 's|/package.json||' | sed 's|^|/|')

echo "Changed packages from git diff:" >&2
echo "$CHANGED_PKGS" >&2

VERSION=""

for pkg_path in $CHANGED_PKGS; do
  is_deployable=false
  for deployable in "${DEPLOYABLE_PATHS[@]}"; do
    if [ "$pkg_path" = "$deployable" ]; then
      is_deployable=true
      break
    fi
  done

  if [ "$is_deployable" = false ]; then
    echo "Skipping non-deployable: $pkg_path" >&2
    continue
  fi

  PKG_JSON_PATH="${REPO_ROOT}${pkg_path}/package.json"
  if [ ! -f "$PKG_JSON_PATH" ]; then
    echo "Warning: package.json not found at $PKG_JSON_PATH" >&2
    continue
  fi

  NEW_VER=$(node -p "require('$PKG_JSON_PATH').version" 2>/dev/null || echo "")
  if [ -z "$NEW_VER" ]; then
    echo "Warning: could not read version from $PKG_JSON_PATH" >&2
    continue
  fi

  echo "Found bump at $pkg_path → $NEW_VER" >&2
  VERSION="$NEW_VER"
  break  # All packages are bumped together — grab the first version found
done

if [ -z "$VERSION" ]; then
  echo "No version bumps detected in deployable packages" >&2
  echo "released=false"
  echo "version="
  exit 0
fi

echo "released=true"
echo "version=$VERSION"
