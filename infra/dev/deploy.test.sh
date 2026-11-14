#!/bin/sh
set -eu
root=$(CDPATH='' cd -- "$(dirname "$0")" && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir "$tmp/bin"
cp "$root/deploy.sh" "$tmp/deploy.sh"
: > "$tmp/.env"
: > "$tmp/compose.yml"
cat > "$tmp/bin/docker" <<'SH'
#!/bin/sh
printf '%s\n' "$*" >> "$TRACE"
case "$*" in
  *"$FAIL_STEP"*) [ -e "$ONCE" ] || { : > "$ONCE"; exit 1; } ;;
esac
SH
chmod +x "$tmp/bin/docker"
export PATH="$tmp/bin:$PATH" TRACE="$tmp/trace" ONCE="$tmp/once" FAIL_STEP
for FAIL_STEP in pull 'run --rm --no-deps migrate' 'run --rm --no-deps preflight' '--remove-orphans core web'; do
  printf 'CORE_IMAGE=old-core\nWEB_IMAGE=old-web\n' > "$tmp/.release.env"
  rm -f "$ONCE" "$TRACE"
  if sh "$tmp/deploy.sh" new-core new-web > "$tmp/log" 2>&1; then
    echo "Expected deployment failure: $FAIL_STEP" >&2; exit 1
  fi
  grep -q CORE_IMAGE=old-core "$tmp/.release.env"
  grep -q 'up -d --wait --wait-timeout 240 core web' "$TRACE"
done
FAIL_STEP=never-match
sh "$tmp/deploy.sh" new-core new-web
grep -q CORE_IMAGE=new-core "$tmp/.release.env"
rm -f "$tmp/.release.env" "$tmp/.release.env.previous"
FAIL_STEP='run --rm --no-deps preflight'
for attempt in 1 2; do
  rm -f "$ONCE" "$TRACE"
  if sh "$tmp/deploy.sh" first-core first-web > "$tmp/log" 2>&1; then
    echo "First-release preflight passed unexpectedly on attempt $attempt" >&2; exit 1
  fi
  test ! -f "$tmp/.release.env"
  if grep -q 'up -d --wait --wait-timeout 240' "$TRACE"; then echo 'Unverified images were started'; exit 1; fi
done
cp "$root/onboard.sh" "$tmp/onboard.sh"
rm -f "$tmp/.release.env" "$TRACE"
FAIL_STEP=never-match
sh "$tmp/onboard.sh" first-core first-web admin@example.test > "$tmp/log" 2>&1
test ! -f "$tmp/.release.env"
test ! -f "$tmp/.release.env.onboarding"
if grep -q preflight "$TRACE"; then echo 'Onboarding ran preflight' >&2; exit 1; fi
grep -q 'up -d --wait --wait-timeout 240 core web' "$TRACE"
grep -q 'bootstrap-admin.ts admin@example.test' "$TRACE"
printf 'CORE_IMAGE=x\nWEB_IMAGE=y\n' > "$tmp/.release.env"
if sh "$tmp/onboard.sh" first-core first-web > "$tmp/log" 2>&1; then
  echo 'Onboarding ran after a release was recorded' >&2; exit 1
fi
rm -f "$tmp/.release.env"
echo 'PASS: successful deploy, first-release onboarding, rollback at each stage'
