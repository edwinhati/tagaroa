#!/bin/sh
# Self-check for ops-alert.sh: sh infra/ops/ops-alert.test.sh
set -eu
dir=$(dirname "$0")
log=$(mktemp)
trap 'rm -f "$log"' EXIT

i=0
while [ $i -lt 60 ]; do i=$((i + 1)); echo "noise $i" >>"$log"; done
cat >>"$log" <<'LOG'
DATABASE_URL=postgres://tagaroa:hunter2@postgres:5432/tagaroa
BETTER_AUTH_SECRET=abc123
  "password": "p4ss", api_key: k3y
curl -H "Authorization: Bearer tok3n" https://x/api/webhooks/autopilots/wh-s3cret
using token mul_abcdefgh12345 and re_ABCDEFGH_123 in configure_database_step
quote " backslash \ tab	end
LOG

out=$(sh "$dir/ops-alert.sh" --dry-run --kind dev-deploy-failed --id 1-1 --env dev \
  --sha abc --step 'Deploy "dev"' --run-url https://github.com/x --log "$log")

for secret in hunter2 abc123 p4ss k3y tok3n wh-s3cret abcdefgh12345 ABCDEFGH_123 'noise 10"'; do
  case $out in *"$secret"*) echo "FAIL: leaked $secret"; exit 1 ;; esac
done
# The last 50 lines are noise 17..60 plus the 6 lines above.
case $out in *'"log_tail":"noise 17\n'*) ;; *) echo "FAIL: not the last 50 lines"; exit 1 ;; esac
case $out in *'configure_database_step'*) ;; *) echo "FAIL: over-scrubbed"; exit 1 ;; esac
case $out in *'"step":"Deploy \"dev\""'*) ;; *) echo "FAIL: escaping"; exit 1 ;; esac

if command -v python3 >/dev/null; then
  printf '%s' "$out" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["kind"]=="dev-deploy-failed" and len(d["log_tail"].splitlines())==50, d'
fi
if sh "$dir/ops-alert.sh" --dry-run --kind nope --id 1 2>/dev/null; then echo "FAIL: bad kind accepted"; exit 1; fi
echo "ops-alert ok"
