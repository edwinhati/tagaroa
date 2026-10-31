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
for FAIL_STEP in pull 'run --rm --no-deps migrate' 'run --rm --no-deps preflight' '--remove-orphans core web'; do
  printf 'CORE_IMAGE=old-core\nWEB_IMAGE=old-web\n' > "$tmp/.release.env"
  rm -f "$ONCE" "$TRACE"
  if sh "$tmp/deploy.sh" new-core new-web > "$tmp/log" 2>&1; then echo "Expected failure: $FAIL_STEP"; exit 1; fi
  grep -q CORE_IMAGE=old-core "$tmp/.release.env"
done
FAIL_STEP=never-match
sh "$tmp/deploy.sh" new-core new-web
cp "$tmp/.release.env.previous" "$tmp/previous"
sh "$tmp/deploy.sh" new-core new-web
cmp "$tmp/previous" "$tmp/.release.env.previous"
sh "$tmp/deploy.sh" --rollback
grep -q CORE_IMAGE=old-core "$tmp/.release.env"
rm -f "$tmp/.release.env" "$tmp/.release.env.previous" "$ONCE"
FAIL_STEP='run --rm --no-deps preflight'
if sh "$tmp/deploy.sh" first-core first-web > "$tmp/log" 2>&1; then echo 'Expected first release refusal'; exit 1; fi
[[ ! -e "$tmp/.release.env" ]]
grep -q 'stop core web' "$TRACE"
echo 'PASS: prod rollback, idempotent retry, explicit rollback, first-release refusal'
