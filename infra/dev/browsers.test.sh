#!/bin/bash
# Signs in through the deployed topology in Chromium, Firefox and WebKit: the
# core image, the four app images exactly as deployed (no URLs baked in: each
# works them out from *.dev.localtest.me), and HTTPS in front routing each host
# to its container the way Pangolin does. Needs Docker and the auth app's
# Playwright browsers. Extra arguments go to Playwright, e.g. `--project webkit`.
set -euo pipefail
core_image=${1:?core image required}
shift
port=${DEPLOYED_PORT:-8443}
root=$(cd "$(dirname "$0")/../.." && pwd)
id="tagaroa-browser-test-$$"
apps=(auth admin workspace engineering)
api="https://dev.localtest.me:$port"
tmp=$(mktemp -d)
chmod 700 "$tmp"
cleanup() {
  docker rm -f "$id-tls" "${apps[@]/#/$id-}" "$id-core" "$id-db" >/dev/null 2>&1 || true
  docker network rm "$id" >/dev/null 2>&1 || true
  docker rmi "${apps[@]/#/$id-}" >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap cleanup EXIT
for app in "${apps[@]}"; do
  dir=apps/$app path=""
  [[ $app != engineering ]] || { dir=domains/engineering path=/engineering; }
  docker build -q -f "$root/infra/web/Dockerfile" -t "$id-$app" \
    --build-arg "APP=$dir" --build-arg "APP_PATH=$path" "$root" >/dev/null
done
docker network create "$id" >/dev/null
docker run -d --rm --name "$id-db" --network "$id" --network-alias postgres \
  --tmpfs /var/lib/postgresql -e POSTGRES_PASSWORD=fixture-password \
  -e POSTGRES_DB=tagaroa postgres:18-alpine >/dev/null
deadline=$((SECONDS + 90))
until docker exec "$id-db" pg_isready -U postgres >/dev/null 2>&1; do
  (( SECONDS < deadline )) || { echo 'Fixture DB timed out'; exit 1; }
  sleep 1
done
cat > "$tmp/env" <<ENV
DATABASE_URL=postgresql://postgres:fixture-password@postgres:5432/tagaroa
NODE_ENV=production
PORT=8080
BETTER_AUTH_SECRET=browser-test-secret-at-least-thirty-two-characters
BETTER_AUTH_URL=$api
TRUSTED_ORIGINS=https://auth.dev.localtest.me:$port,https://admin.dev.localtest.me:$port,https://app.dev.localtest.me:$port
PASSKEY_ORIGINS=https://auth.dev.localtest.me:$port,https://app.dev.localtest.me:$port
PASSKEY_RP_ID=dev.localtest.me
NOTIFICATION_WORKER=0
ENV
docker run --rm --network "$id" --env-file "$tmp/env" "$core_image" bun dist/migrate.js >/dev/null
docker run --rm --network "$id" --env-file "$tmp/env" "$core_image" \
  bun scripts/bootstrap-admin.ts first-admin@fixture.invalid > "$tmp/bootstrap" 2>&1
docker run -d --rm --name "$id-core" --network "$id" --network-alias core \
  --env-file "$tmp/env" "$core_image" >/dev/null
for app in "${apps[@]}"; do
  docker run -d --rm --name "$id-$app" --network "$id" --network-alias "$app" \
    -e BASE_DOMAIN=dev.localtest.me "$id-$app" >/dev/null
done
# Pangolin's routes: a resource per host, app.'s /engineering* and the API's /api* by path.
cat > "$tmp/Caddyfile" <<CADDY
{
	admin off
	skip_install_trust
}
https://auth.dev.localtest.me:$port {
	tls internal
	reverse_proxy auth:80
}
https://admin.dev.localtest.me:$port {
	tls internal
	reverse_proxy admin:80
}
https://app.dev.localtest.me:$port {
	tls internal
	handle /engineering* {
		reverse_proxy engineering:80
	}
	handle {
		reverse_proxy workspace:80
	}
}
https://dev.localtest.me:$port {
	tls internal
	handle /api/* {
		reverse_proxy core:8080
	}
	handle {
		respond 404
	}
}
CADDY
docker run -d --rm --name "$id-tls" --network "$id" -p "127.0.0.1:$port:$port" \
  -v "$tmp/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2-alpine >/dev/null
deadline=$((SECONDS + 90))
until curl -skf "$api/api/health/live" >/dev/null; do
  (( SECONDS < deadline )) || { echo 'Stack timed out'; exit 1; }
  sleep 1
done
cd "$root/apps/auth"
DEPLOYED_PORT=$port \
  BOOTSTRAP_PASSWORD=$(sed -n 's/^Temporary password.*: //p' "$tmp/bootstrap") \
  bunx --bun --no-install playwright test --config playwright.deployed.config.ts "$@"
echo 'PASS: deployed sign-in keeps a host-only session on the API host in every browser'
