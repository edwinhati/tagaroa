#!/bin/sh
# Self-check for deploy.sh with docker stubbed: sh infra/deploy/deploy.test.sh
# Runs it once as dev (own postgres, no .ocir) and once as prod (.ocir, shared postgres).
set -eu
root=$(CDPATH='' cd -- "$(dirname "$0")" && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir "$tmp/bin"
cat > "$tmp/bin/docker" <<'SH'
#!/bin/sh
printf '%s\n' "$*" >> "$TRACE"
case "$*" in
  login*) cat >/dev/null ;;
  *"config --services"*) [ -z "$POSTGRES" ] || echo postgres ;;
esac
case "$*" in
  *"$FAIL_STEP"*) [ -e "$ONCE" ] || { : > "$ONCE"; exit 1; } ;;
esac
SH
chmod +x "$tmp/bin/docker"
export PATH="$tmp/bin:$PATH" TRACE="$tmp/trace" ONCE="$tmp/once" FAIL_STEP POSTGRES
services='core auth admin workspace engineering'
release() { # tag
  printf 'RELEASE_SHA=%040d\n' 0
  for name in core auth admin workspace engineering; do
    printf '%s_IMAGE=registry.test/tagaroa/%s:%s\n' "$(echo "$name" | tr '[:lower:]' '[:upper:]')" "$name" "$1"
  done
}

for server in dev prod; do
  dir="$tmp/$server"
  mkdir "$dir"
  cp "$root/deploy.sh" "$dir/"
  : > "$dir/.env"
  : > "$dir/compose.yml"
  if [ $server = dev ]; then POSTGRES=1; else POSTGRES=; printf 'OCIR_USERNAME=fixture\nOCIR_TOKEN=fixture\n' > "$dir/.ocir"; fi
  steps="pull|run --rm --no-deps migrate|run --rm --no-deps preflight|--remove-orphans $services"
  [ -z "$POSTGRES" ] || steps="$steps|up -d --wait postgres"

  # A failure at any step brings the previous images back.
  echo "$steps" | tr '|' '\n' > "$tmp/steps"
  while IFS= read -r FAIL_STEP; do
    release old > "$dir/.release.env"
    rm -f "$ONCE" "$TRACE"
    if release new | sh "$dir/deploy.sh" > "$tmp/log" 2>&1; then
      echo "$server: expected deployment failure: $FAIL_STEP" >&2; exit 1
    fi
    grep -q 'core:old' "$dir/.release.env"
    grep -q "up -d --wait --wait-timeout 240 $services" "$TRACE"
  done < "$tmp/steps"

  FAIL_STEP=never-match
  rm -f "$TRACE"
  release new | sh "$dir/deploy.sh" > "$tmp/log"
  grep -q 'engineering:new' "$dir/.release.env"
  grep -q 'core:old' "$dir/.release.env.previous"
  # Each server's own setup: prod logs in to OCIR, dev starts its postgres.
  if [ $server = prod ]; then grep -q '^login sin.ocir.io --username fixture' "$TRACE"
  elif grep -q '^login' "$TRACE"; then echo 'dev: logged in to OCIR' >&2; exit 1; fi
  if [ -n "$POSTGRES" ]; then grep -q 'up -d --wait postgres' "$TRACE"
  elif grep -q 'up -d --wait postgres' "$TRACE"; then echo 'prod: started a postgres service' >&2; exit 1; fi
  # Deploying the same release again keeps the release before it.
  cp "$dir/.release.env.previous" "$tmp/previous"
  release new | sh "$dir/deploy.sh" > "$tmp/log"
  cmp -s "$tmp/previous" "$dir/.release.env.previous"

  # --rollback restores the release before this one; with none it stops the first release.
  sh "$dir/deploy.sh" --rollback > "$tmp/log"
  grep -q 'core:old' "$dir/.release.env"
  rm -f "$dir/.release.env.previous" "$TRACE"
  sh "$dir/deploy.sh" --rollback > "$tmp/log"
  test ! -f "$dir/.release.env"
  grep -q "stop $services" "$TRACE"

  # A release that is not exactly the six keys never reaches docker.
  for bad in "$(release new; echo 'EXTRA_IMAGE=x')" "$(release new | grep -v AUTH_IMAGE)" "$(release new | sed 's/:new$/:new;rm -rf ~/')"; do
    rm -f "$TRACE"
    if printf '%s\n' "$bad" | sh "$dir/deploy.sh" > "$tmp/log" 2>&1; then echo "$server: accepted a malformed release" >&2; exit 1; fi
    test ! -f "$TRACE"
  done

  # A first release that fails preflight is stopped, never started.
  rm -f "$dir/.release.env" "$dir/.release.env.previous" "$ONCE" "$TRACE"
  FAIL_STEP='run --rm --no-deps preflight'
  if release first | sh "$dir/deploy.sh" > "$tmp/log" 2>&1; then
    echo "$server: first-release preflight passed unexpectedly" >&2; exit 1
  fi
  test ! -f "$dir/.release.env"
  grep -q "stop $services" "$TRACE"
  if grep -q 'up -d --wait --wait-timeout 240' "$TRACE"; then echo "$server: unverified images were started" >&2; exit 1; fi
done
echo 'PASS: dev and prod: rollback at each stage, deploy, idempotent retry, explicit rollback, malformed releases, first-release refusal'
