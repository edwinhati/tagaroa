#!/bin/sh
# Opens an "Ops alert" issue for Rex in Multica (docs/ops/workflows/ops-alerts.md).
#
#   MULTICA_OPS_WEBHOOK=... ops-alert.sh --kind dev-deploy-failed --id "$RUN_ID-$ATTEMPT" \
#     [--env dev|prod] [--sha SHA] [--step STEP] [--run-url URL] [--log FILE]
#
# --log sends the file's last 50 lines with secrets scrubbed. Never pass a .env file.
# --dry-run prints the JSON body instead of sending it.
set -eu

kind='' id='' env='' sha='' step='' run_url='' log='' dry_run=''
# shellcheck disable=SC2034 # env, sha, step and run_url are read through eval below.
while [ $# -gt 0 ]; do
  case $1 in
    --kind) kind=$2; shift 2 ;;
    --id) id=$2; shift 2 ;;
    --env) env=$2; shift 2 ;;
    --sha) sha=$2; shift 2 ;;
    --step) step=$2; shift 2 ;;
    --run-url) run_url=$2; shift 2 ;;
    --log) log=$2; shift 2 ;;
    --dry-run) dry_run=1; shift ;;
    *) echo "ops-alert: unknown argument $1" >&2; exit 2 ;;
  esac
done
case $kind in
  prod-down | dev-deploy-failed | dev-brief-failed | restore-test-failed) ;;
  *) echo "ops-alert: --kind must be prod-down, dev-deploy-failed, dev-brief-failed or restore-test-failed" >&2; exit 2 ;;
esac
[ -n "$id" ] || { echo "ops-alert: --id is required" >&2; exit 2; }

# Credentials in URLs, bearer tokens and known token prefixes. After a secret-looking key
# (key=value, key: value) the rest of the line goes, so no part of a quoted or listed value leaks.
scrub() {
  sed -E \
    -e 's#(://)[^/@[:space:]]+@#\1***@#g' \
    -e 's#(/api/webhooks/autopilots/)[^[:space:]"]+#\1***#g' \
    -e 's#(([Aa]uthorization|[Cc]ookie)"?[[:space:]]*[:=][[:space:]]*).*#\1***#' \
    -e 's#([Bb]earer[[:space:]]+)[^[:space:]"]+#\1***#g' \
    -e 's#([A-Za-z0-9_]*([Ss][Ee][Cc][Rr][Ee][Tt]|[Tt][Oo][Kk][Ee][Nn]|[Pp][Aa][Ss][Ss][Ww]?[Oo]?[Rr]?[Dd]|[Aa][Pp][Ii]_?[Kk][Ee][Yy]|[Pp][Rr][Ii][Vv][Aa][Tt][Ee]_?[Kk][Ee][Yy])[A-Za-z0-9_]*"?[[:space:]]*[:=][[:space:]]*).*#\1***#' \
    -e 's#(^|[^A-Za-z0-9])(mul|re|ghp|gho|ghs|github_pat)_[A-Za-z0-9_]{8,}#\1\2_***#g'
}

# JSON string literal of stdin.
json_str() {
  awk 'BEGIN { ORS = ""; print "\"" }
    NR > 1 { print "\\n" }
    { gsub(/\\/, "\\\\"); gsub(/"/, "\\\""); gsub(/\t/, "\\t"); gsub(/\r/, "");
      gsub(/[\001-\037]/, ""); print }
    END { print "\"" }'
}

body="{\"kind\":\"$kind\""
for field in env sha step run_url; do
  eval "value=\$$field"
  [ -z "$value" ] || body="$body,\"$field\":$(printf '%s' "$value" | json_str)"
done
if [ -n "$log" ]; then
  # A plain assignment, so set -e stops here when the log cannot be read.
  log_tail=$(tail -n 50 -- "$log")
  body="$body,\"log_tail\":$(printf '%s\n' "$log_tail" | scrub | json_str)"
fi
body="$body}"

if [ -n "$dry_run" ]; then
  printf '%s\n' "$body"
  exit 0
fi
: "${MULTICA_OPS_WEBHOOK:?ops-alert: MULTICA_OPS_WEBHOOK is not set}"
printf '%s' "$body" | curl -fsS -o /dev/null -X POST "$MULTICA_OPS_WEBHOOK" \
  -H 'Content-Type: application/json' \
  -H "Idempotency-Key: $kind-$id" \
  --data-binary @-
