#!/bin/bash
# Run after building both images; uses only throwaway containers and a private network.
set -euo pipefail
core_image=${1:?core image required}
web_image=${2:?web image required}
id="tagaroa-image-test-$$"
tmp=$(mktemp -d)
chmod 700 "$tmp"
cleanup() {
  docker rm -f "$id-core" "$id-web" "$id-db" >/dev/null 2>&1 || true
  docker network rm "$id" >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap cleanup EXIT
docker network create "$id" >/dev/null
docker run -d --rm --name "$id-db" --network "$id" --network-alias postgres \
  --tmpfs /var/lib/postgresql -e POSTGRES_PASSWORD=fixture-password \
  -e POSTGRES_DB=tagaroa postgres:18-alpine >/dev/null
deadline=$((SECONDS + 90))
until docker exec "$id-db" pg_isready -U postgres >/dev/null 2>&1; do
  (( SECONDS < deadline )) || { echo 'Fixture DB timed out'; exit 1; }
  sleep 1
done
cat > "$tmp/env" <<'ENV'
DATABASE_URL=postgresql://postgres:fixture-password@postgres:5432/tagaroa
NODE_ENV=production
PORT=8080
BETTER_AUTH_SECRET=image-test-secret-at-least-thirty-two-characters
BETTER_AUTH_URL=https://dev.tagaroa.cc
TRUSTED_ORIGINS=https://auth.dev.tagaroa.cc,https://admin.dev.tagaroa.cc,https://app.dev.tagaroa.cc
PASSKEY_ORIGINS=https://auth.dev.tagaroa.cc,https://app.dev.tagaroa.cc
PASSKEY_RP_ID=dev.tagaroa.cc
NOTIFICATION_WORKER=0
ENV
docker run --rm --network "$id" --env-file "$tmp/env" "$core_image" bun dist/migrate.js
docker run --rm --network "$id" --env-file "$tmp/env" "$core_image" \
  bun scripts/bootstrap-admin.ts first-admin@fixture.invalid > "$tmp/bootstrap" 2>&1
if docker run --rm --network "$id" --env-file "$tmp/env" "$core_image" \
  bun scripts/bootstrap-admin.ts second-admin@fixture.invalid > "$tmp/second-bootstrap" 2>&1; then
  echo 'Bootstrap incorrectly allowed a second first-admin'; exit 1
fi
grep -q 'super-admin already exists' "$tmp/second-bootstrap"
count=$(docker exec "$id-db" psql -U postgres -d tagaroa -Atc \
  'SELECT count(*) FROM auth."user" WHERE role='"'super-admin'"' AND must_change_password=true')
[[ "$count" == 1 ]]
if docker run --rm --network "$id" --env-file "$tmp/env" "$core_image" \
  bun scripts/security-preflight.ts > "$tmp/preflight" 2>&1; then
  echo 'Preflight accepted an unstaffed environment'; exit 1
fi
grep -q 'FAIL independent-recovery-operators' "$tmp/preflight"
docker run -d --rm --name "$id-core" --network "$id" --network-alias core \
  --env-file "$tmp/env" "$core_image" >/dev/null
docker run -d --rm --name "$id-web" --network "$id" --network-alias web \
  -e BASE_DOMAIN=dev.tagaroa.cc "$web_image" >/dev/null
deadline=$((SECONDS + 90))
until docker exec "$id-core" bun -e "fetch('http://localhost:8080/api/health/live').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))" >/dev/null 2>&1; do
  (( SECONDS < deadline )) || { echo 'Core image timed out'; exit 1; }
  sleep 1
done
docker exec "$id-core" bun -e '
for (const [host,path,type] of [["auth.dev.tagaroa.cc","/","text/html"],["admin.dev.tagaroa.cc","/","text/html"],["app.dev.tagaroa.cc","/","text/html"],["app.dev.tagaroa.cc","/engineering","text/html"],["dev.tagaroa.cc","/api/health/live","application/json"]]) {
  const r = await fetch("http://web"+path,{headers:{host}});
  if(r.status!==200 || !r.headers.get("content-type")?.startsWith(type)) throw new Error(host+path+": "+r.status);
  console.log("PASS "+host+path);
}'
# Sign in the way the door does (API host, auth. origin), then read the session as app. does.
password=$(sed -n 's/^Temporary password.*: //p' "$tmp/bootstrap")
docker exec -e PASSWORD="$password" "$id-core" bun -e '
const signIn = await fetch("http://web/api/auth/sign-in/email", {
  method: "POST",
  headers: { host: "dev.tagaroa.cc", origin: "https://auth.dev.tagaroa.cc", "content-type": "application/json" },
  body: JSON.stringify({ email: "first-admin@fixture.invalid", password: process.env.PASSWORD }),
});
const session = signIn.headers.getSetCookie().find((c) => c.startsWith("__Host-better-auth.session_token="));
if (!signIn.ok || !session || /; Domain=/i.test(session) || !/; Secure/i.test(session) || !/; Path=\/(;|$)/i.test(session)) throw new Error("sign-in cookie: " + signIn.status + " " + session);
const r = await fetch("http://web/api/auth/get-session", {
  headers: { host: "dev.tagaroa.cc", origin: "https://app.dev.tagaroa.cc", cookie: session.split(";")[0] },
});
if ((await r.json())?.user?.email !== "first-admin@fixture.invalid") throw new Error("no session on the API host");
console.log("PASS sign-in sets a host-only __Host- session cookie on dev.tagaroa.cc");'
echo 'PASS: image migrations, first-admin bootstrap, preflight refusal, core and SPA routing, host-only session'
