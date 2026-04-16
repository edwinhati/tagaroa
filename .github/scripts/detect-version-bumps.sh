#!/usr/bin/env bash
set -euo pipefail

# Detect version-bumped deployable components by parsing git diff
# Outputs: released, version, apps (GitHub Actions matrix JSON)
# All debug output goes to stderr; only key=value lines go to stdout (>> $GITHUB_OUTPUT)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$REPO_ROOT"

declare -A PKG_TO_COMPONENT=(
  ["finance"]="finance-app"
  ["auth"]="auth-app"
  ["web"]="web-app"
  ["admin"]="admin-app"
  ["investment"]="investment-app"
  ["core-service"]="core-service"
)

declare -A PKG_TO_DOCKERFILE=(
  ["finance"]="apps/finance/Dockerfile"
  ["auth"]="apps/auth/Dockerfile"
  ["web"]="apps/web/Dockerfile"
  ["admin"]="apps/admin/Dockerfile"
  ["investment"]="apps/investment/Dockerfile"
  ["core-service"]="servers/core/Dockerfile"
)

declare -A PKG_TO_SENTRY_PROJECT=(
  ["finance"]="finance-app"
  ["auth"]="auth-app"
  ["web"]="web-app"
  ["admin"]="admin-app"
  ["investment"]="investment-app"
  ["core-service"]="core-service"
)

declare -A PKG_TO_SENTRY_DSN=(
  ["finance"]="${FINANCE_APP_SENTRY_DSN:-}"
  ["auth"]="${AUTH_APP_SENTRY_DSN:-}"
  ["web"]="${WEB_APP_SENTRY_DSN:-}"
  ["admin"]="${ADMIN_APP_SENTRY_DSN:-}"
  ["investment"]="${INVESTMENT_APP_SENTRY_DSN:-}"
  ["core-service"]="${CORE_SERVICE_SENTRY_DSN:-}"
)

CHANGED_PKGS=$(git diff --name-only HEAD~1 HEAD 2>/dev/null | grep 'package.json$' | sed 's|/package.json||' | sed 's|^|/|')

echo "Changed packages from git diff:" >&2
echo "$CHANGED_PKGS" >&2

declare -a COMPONENTS=()
declare -a VERSIONS=()
declare -a TAG_LIST=()
INCLUDE_JSON='{"include":['

first=true
has_bumps=false

for pkg_path in $CHANGED_PKGS; do
  case "$pkg_path" in
    /apps/finance)    PKG_NAME="finance" ;;
    /apps/auth)       PKG_NAME="auth" ;;
    /apps/web)        PKG_NAME="web" ;;
    /apps/admin)      PKG_NAME="admin" ;;
    /apps/investment) PKG_NAME="investment" ;;
    /servers/core)    PKG_NAME="core-service" ;;
    *)
      echo "Skipping non-deployable package at: $pkg_path" >&2
      continue
      ;;
  esac

  if [[ -z "${PKG_TO_COMPONENT[$PKG_NAME]:-}" ]]; then
    echo "Skipping non-deployable: $PKG_NAME" >&2
    continue
  fi

  COMPONENT="${PKG_TO_COMPONENT[$PKG_NAME]}"
  DOCKERFILE="${PKG_TO_DOCKERFILE[$PKG_NAME]}"
  SENTRY_PROJECT="${PKG_TO_SENTRY_PROJECT[$PKG_NAME]}"
  SENTRY_DSN="${PKG_TO_SENTRY_DSN[$PKG_NAME]:-}"

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

  has_bumps=true
  echo "Found bump: $PKG_NAME → $COMPONENT@$NEW_VER" >&2

  if [ "$first" = true ]; then
    first=false
  else
    INCLUDE_JSON+=","
  fi

  INCLUDE_JSON+="{\"component\":\"$COMPONENT\",\"version\":\"$NEW_VER\",\"dockerfile\":\"$DOCKERFILE\",\"sentry_project\":\"$SENTRY_PROJECT\",\"sentry_dsn\":\"$SENTRY_DSN\"}"
  COMPONENTS+=("$COMPONENT")
  VERSIONS+=("$NEW_VER")
  TAG_LIST+=("$COMPONENT@$NEW_VER")
done

INCLUDE_JSON+="]}"

if [ "$has_bumps" = false ]; then
  echo "No version bumps detected" >&2
  echo "released=false"
  echo "version="
  echo 'apps={"include":[]}'
  exit 0
fi

git config user.name "github-actions[bot]" 2>/dev/null || true
git config user.email "41898282+github-actions[bot]@users.noreply.github.com" 2>/dev/null || true

echo "Creating git tags..." >&2
for tag in "${TAG_LIST[@]}"; do
  if git ls-remote --tags origin 2>/dev/null | grep -q "refs/tags/${tag}$"; then
    echo "Tag ${tag} already exists, skipping." >&2
  else
    git tag -a "${tag}" -m "Release ${tag}"
    git push origin "${tag}" || echo "Warning: failed to push tag ${tag}" >&2
  fi
done

VERSION_STR=$(IFS=','; echo "${TAG_LIST[*]}")
echo "released=true"
echo "version=$VERSION_STR"
echo "apps=$INCLUDE_JSON"
