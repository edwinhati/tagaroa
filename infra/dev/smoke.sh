#!/bin/sh
# Runs on the droplet after deploy.sh, from /home/tagaroa/apps: asks dev's web
# container for each app by host name, as Pangolin does, and fails on the first
# that does not answer.
set -eu
ip=$(docker inspect -f '{{(index .NetworkSettings.Networks "pangolin_default").IPAddress}}' tagaroa-dev-web-1)
check() { # host path expected-content-type-prefix
  for _ in $(seq 1 15); do
    out=$(curl -s -o /dev/null -w '%{http_code} %{content_type}' -H "Host: $1" "http://$ip$2" || true)
    case "$out" in "200 $3"*) echo "ok   $1$2 -> $out"; return 0 ;; esac
    sleep 2
  done
  echo "FAIL $1$2 -> $out"
  return 1
}
check dev.tagaroa.cc /api/health/live application/json
check app.dev.tagaroa.cc / text/html
check auth.dev.tagaroa.cc / text/html
check admin.dev.tagaroa.cc / text/html
check app.dev.tagaroa.cc /engineering text/html
