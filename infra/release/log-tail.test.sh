#!/bin/sh
# Self-check for log-tail.sh: sh infra/release/log-tail.test.sh
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
password="alph4 b3ta" PASSWORD=g4mma,d3lta
client_secret: 'eps1lon!z3ta' (rotated)
curl -H "Authorization: Bearer tok3n" https://x/hook/wh-s3cret
using token mul_abcdefgh12345 and re_ABCDEFGH_123 in configure_database_step
LOG

out=$(sh "$dir/log-tail.sh" "$log")

for secret in hunter2 abc123 p4ss k3y alph4 b3ta g4mma d3lta eps1lon z3ta rotated tok3n wh-s3cret abcdefgh12345 ABCDEFGH_123; do
  case $out in *"$secret"*) echo "FAIL: leaked $secret"; exit 1 ;; esac
done
# The last 50 lines are noise 18..60 plus the 7 lines above.
[ "$(printf '%s\n' "$out" | wc -l | tr -d ' ')" = 50 ] || { echo "FAIL: not 50 lines"; exit 1; }
[ "$(printf '%s\n' "$out" | head -n 1)" = 'noise 18' ] || { echo "FAIL: not the last 50 lines"; exit 1; }
case $out in *'configure_database_step'*) ;; *) echo "FAIL: over-scrubbed"; exit 1 ;; esac

if sh "$dir/log-tail.sh" "$log.missing" 2>/dev/null; then echo "FAIL: missing log accepted"; exit 1; fi
echo "log-tail ok"
