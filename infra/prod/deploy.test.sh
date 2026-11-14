#!/bin/bash
set -euo pipefail
root=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir "$tmp/bin"
cp "$root/deploy.sh" "$tmp/deploy.sh"
: > "$tmp/.env"
: > "$tmp/compose.yml"
printf 'OCIR_USERNAME=fixture\nOCIR_TOKEN=fixture\n' > "$tmp/.ocir"
cat > "$tmp/bin/docker" <<'SH'
#!/bin/sh
echo "$*" >> "$TRACE"
case "$*" in
  login*) cat >/dev/null ;;
esac
case "$*" in
  *"$FAIL_STEP"*) [ -e "$ONCE" ] || { : > "$ONCE"; exit 1; } ;;
esac
SH
chmod +x "$tmp/bin/docker"
export PATH="$tmp/bin:$PATH" TRACE="$tmp/trace" ONCE="$tmp/once" FAIL_STEP
services='core auth admin workspace engineering'
release() { # version
  printf 'RELEASE_SHA=%040d\n' 0
  for name in CORE AUTH ADMIN WORKSPACE ENGINEERING; do printf '%s_IMAGE=sin.ocir.io/ns/tagaroa/x:%s\n' "$name" "$1"; done
}
for FAIL_STEP in pull 'run --rm --no-deps migrate' 'run --rm --no-deps preflight' "--remove-orphans $services"; do
  release 0.1.0 > "$tmp/.release.env"
  rm -f "$ONCE" "$TRACE"
  if release 0.2.0 | sh "$tmp/deploy.sh" > "$tmp/log" 2>&1; then echo "Expected failure: $FAIL_STEP"; exit 1; fi
  grep -q 'CORE_IMAGE=.*:0.1.0' "$tmp/.release.env"
done
FAIL_STEP=never-match
release 0.2.0 | sh "$tmp/deploy.sh"
cp "$tmp/.release.env.previous" "$tmp/previous"
release 0.2.0 | sh "$tmp/deploy.sh"
cmp "$tmp/previous" "$tmp/.release.env.previous"
sh "$tmp/deploy.sh" --rollback
grep -q 'CORE_IMAGE=.*:0.1.0' "$tmp/.release.env"
rm -f "$TRACE"
if { release 0.3.0; echo 'EXTRA_IMAGE=x'; } | sh "$tmp/deploy.sh" > "$tmp/log" 2>&1; then echo 'Accepted a malformed release'; exit 1; fi
[[ ! -e "$TRACE" ]]
rm -f "$tmp/.release.env" "$tmp/.release.env.previous" "$ONCE"
FAIL_STEP='run --rm --no-deps preflight'
if release 0.1.0 | sh "$tmp/deploy.sh" > "$tmp/log" 2>&1; then echo 'Expected first release refusal'; exit 1; fi
[[ ! -e "$tmp/.release.env" ]]
grep -q "stop $services" "$TRACE"
echo 'PASS: prod rollback, idempotent retry, explicit rollback, malformed release, first-release refusal'
