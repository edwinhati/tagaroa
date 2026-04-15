#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

# Package name → Component name mapping
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

# Determine base branch for comparison
if [ "${GITHUB_EVENT_NAME:-}" = "pull_request" ]; then
  BASE_BRANCH="origin/${{ github.event.pull_request.base.ref }}"
else
  BASE_BRANCH="origin/main"
fi

echo "Detecting changed apps compared to: $BASE_BRANCH"

# Get changed packages using turbo --filter
# --filter=...[BASE] means: package + dependents that changed since BASE
TURBO_OUTPUT=$(bun turbo run build --filter="...[$BASE_BRANCH]" --dry=json 2>/dev/null || echo '{"packages":[]}')
echo "Turbo output: $TURBO_OUTPUT"

PACKAGES=$(echo "$TURBO_OUTPUT" | jq -r '.packages[]' 2>/dev/null || echo "")

if [ -z "$PACKAGES" ]; then
  echo "No changed packages detected or turbo failed, falling back to all apps"
  # Fall back to all deployable components
  ALL_COMPONENTS="finance-app auth-app web-app admin-app investment-app core-service"
  INCLUDE_JSON="{\"include\":["
  first=true
  for comp in $ALL_COMPONENTS; do
    case "$comp" in
      finance-app) DOCKERFILE="apps/finance/Dockerfile" ;;
      auth-app) DOCKERFILE="apps/auth/Dockerfile" ;;
      web-app) DOCKERFILE="apps/web/Dockerfile" ;;
      admin-app) DOCKERFILE="apps/admin/Dockerfile" ;;
      investment-app) DOCKERFILE="apps/investment/Dockerfile" ;;
      core-service) DOCKERFILE="servers/core/Dockerfile" ;;
    esac
    if [ "$first" = true ]; then
      first=false
    else
      INCLUDE_JSON+=","
    fi
    INCLUDE_JSON+="{\"component\":\"$comp\",\"dockerfile\":\"$DOCKERFILE\"}"
  done
  INCLUDE_JSON+="]}"
  echo "matrix=$INCLUDE_JSON"
  echo "fallback=true"
  exit 0
fi

# Build matrix from changed packages
INCLUDE_JSON="{\"include\":["
first=true
for pkg in $PACKAGES; do
  COMP="${PKG_TO_COMPONENT[$pkg]:-}"
  DOCKERFILE="${PKG_TO_DOCKERFILE[$pkg]:-}"
  
  if [ -z "$COMP" ] || [ -z "$DOCKERFILE" ]; then
    continue
  fi
  
  if [ "$first" = true ]; then
    first=false
  else
    INCLUDE_JSON+=","
  fi
  
  INCLUDE_JSON+="{\"component\":\"$COMP\",\"dockerfile\":\"$DOCKERFILE\"}"
  echo "Changed: $pkg → $COMP"
done

INCLUDE_JSON+="]}"

if [ "$first" = true ]; then
  echo "No deployable components changed, using all apps"
  # Recursive call with fallback
  ALL_COMPONENTS="finance-app auth-app web-app admin-app investment-app core-service"
  INCLUDE_JSON="{\"include\":["
  first=true
  for comp in $ALL_COMPONENTS; do
    case "$comp" in
      finance-app) DOCKERFILE="apps/finance/Dockerfile" ;;
      auth-app) DOCKERFILE="apps/auth/Dockerfile" ;;
      web-app) DOCKERFILE="apps/web/Dockerfile" ;;
      admin-app) DOCKERFILE="apps/admin/Dockerfile" ;;
      investment-app) DOCKERFILE="apps/investment/Dockerfile" ;;
      core-service) DOCKERFILE="servers/core/Dockerfile" ;;
    esac
    if [ "$first" = true ]; then
      first=false
    else
      INCLUDE_JSON+=","
    fi
    INCLUDE_JSON+="{\"component\":\"$comp\",\"dockerfile\":\"$DOCKERFILE\"}"
  done
  INCLUDE_JSON+="]}"
fi

echo "matrix=$INCLUDE_JSON"
echo "fallback=false"
