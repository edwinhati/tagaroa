#!/bin/sh
# Runs on the droplet after deploy.sh, from /home/tagaroa/apps: asks core and each
# app on pangolin_default, where Pangolin reaches them, and fails on the first that
# does not answer.
set -eu
check() { # service port path expected-content-type-prefix
  ip=$(docker inspect -f '{{(index .NetworkSettings.Networks "pangolin_default").IPAddress}}' "tagaroa-dev-$1-1")
  for _ in $(seq 1 15); do
    out=$(curl -s -o /dev/null -w '%{http_code} %{content_type}' "http://$ip:$2$3" || true)
    case "$out" in "200 $4"*) echo "ok   $1$3 -> $out"; return 0 ;; esac
    sleep 2
  done
  echo "FAIL $1$3 -> $out"
  return 1
}
check core 8080 /api/health/live application/json
check auth 80 / text/html
check admin 80 / text/html
check workspace 80 / text/html
check engineering 80 /engineering text/html
