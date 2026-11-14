#!/bin/sh
set -eu
root=$(CDPATH='' cd -- "$(dirname "$0")" && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir "$tmp/bin"
cp "$root/deploy.sh" "$root/onboard.sh" "$tmp/"
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
services='core auth admin workspace engineering'
release() { # tag
  printf 'RELEASE_SHA=%040d\n' 0
  for name in core auth admin workspace engineering; do
    printf '%s_IMAGE=registry.test/tagaroa/%s:%s\n' "$(echo "$name" | tr '[:lower:]' '[:upper:]')" "$name" "$1"
  done
}

for FAIL_STEP in pull 'run --rm --no-deps migrate' 'run --rm --no-deps preflight' "--remove-orphans $services"; do
  release old > "$tmp/.release.env"
  rm -f "$ONCE" "$TRACE"
  if release new | sh "$tmp/deploy.sh" > "$tmp/log" 2>&1; then
    echo "Expected deployment failure: $FAIL_STEP" >&2; exit 1
  fi
  grep -q 'core:old' "$tmp/.release.env"
  grep -q "up -d --wait --wait-timeout 240 $services" "$TRACE"
done
FAIL_STEP=never-match
release new | sh "$tmp/deploy.sh"
grep -q 'engineering:new' "$tmp/.release.env"
grep -q 'core:old' "$tmp/.release.env.previous"

# A release that is not exactly the six keys never reaches docker.
for bad in "$(release new; echo 'EXTRA_IMAGE=x')" "$(release new | grep -v AUTH_IMAGE)" "$(release new | sed 's/:new$/:new;rm -rf ~/')"; do
  rm -f "$TRACE"
  if printf '%s\n' "$bad" | sh "$tmp/deploy.sh" > "$tmp/log" 2>&1; then echo "Accepted a malformed release" >&2; exit 1; fi
  test ! -f "$TRACE"
done

rm -f "$tmp/.release.env" "$tmp/.release.env.previous"
FAIL_STEP='run --rm --no-deps preflight'
for attempt in 1 2; do
  rm -f "$ONCE" "$TRACE"
  if release first | sh "$tmp/deploy.sh" > "$tmp/log" 2>&1; then
    echo "First-release preflight passed unexpectedly on attempt $attempt" >&2; exit 1
  fi
  test ! -f "$tmp/.release.env"
  if grep -q 'up -d --wait --wait-timeout 240' "$TRACE"; then echo 'Unverified images were started'; exit 1; fi
done

rm -f "$tmp/.release.env" "$TRACE"
FAIL_STEP=never-match
release first | sh "$tmp/onboard.sh" admin@example.test > "$tmp/log" 2>&1
test ! -f "$tmp/.release.env"
test ! -f "$tmp/.release.env.onboarding"
if grep -q preflight "$TRACE"; then echo 'Onboarding ran preflight' >&2; exit 1; fi
grep -q "up -d --wait --wait-timeout 240 $services" "$TRACE"
grep -q 'bootstrap-admin.ts admin@example.test' "$TRACE"
release old > "$tmp/.release.env"
release first > "$tmp/first"
if sh "$tmp/onboard.sh" < "$tmp/first" > "$tmp/log" 2>&1; then
  echo 'Onboarding ran after a release was recorded' >&2; exit 1
fi
echo 'PASS: successful deploy, malformed releases, first-release onboarding, rollback at each stage'
