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
for event in pull_request pull_request_target issue_comment; do
  if GITHUB_EVENT_NAME=$event GITHUB_REF=refs/heads/main sh "$root/../runner/hooks/job-started.sh" > "$tmp/log" 2>&1; then
    echo "Runner accepted untrusted event: $event" >&2; exit 1
  fi
done
for event in push workflow_run workflow_dispatch schedule; do
  GITHUB_EVENT_NAME=$event GITHUB_REF=refs/heads/main sh "$root/../runner/hooks/job-started.sh"
done
if GITHUB_EVENT_NAME=workflow_dispatch GITHUB_REF=refs/heads/untrusted sh "$root/../runner/hooks/job-started.sh" > "$tmp/log" 2>&1; then
  echo 'Runner accepted a non-main ref' >&2; exit 1
fi
echo 'PASS: successful deploy, rollback at each stage, runner trust boundary'
