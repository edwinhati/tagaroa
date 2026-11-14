#!/bin/bash
# Run after building the images, with deploy.sh's release lines on stdin:
#   bash infra/dev/images.test.sh < release
# Uses only throwaway containers and a private network.
set -euo pipefail
while IFS='=' read -r key value; do
  case $key in CORE_IMAGE | AUTH_IMAGE | ADMIN_IMAGE | WORKSPACE_IMAGE | ENGINEERING_IMAGE) printf -v "$key" '%s' "$value" ;; esac
done
: "${CORE_IMAGE:?}" "${AUTH_IMAGE:?}" "${ADMIN_IMAGE:?}" "${WORKSPACE_IMAGE:?}" "${ENGINEERING_IMAGE:?}"
core_image=$CORE_IMAGE
apps=(auth admin workspace engineering)
id="tagaroa-image-test-$$"
tmp=$(mktemp -d)
chmod 700 "$tmp"
cleanup() {
  docker rm -f "$id-core" "${apps[@]/#/$id-}" "$id-db" >/dev/null 2>&1 || true
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
for app in "${apps[@]}"; do
  image_var="$(tr '[:lower:]' '[:upper:]' <<< "$app")_IMAGE"
  docker run -d --rm --name "$id-$app" --network "$id" --network-alias "$app" \
    -e BASE_DOMAIN=dev.tagaroa.cc "${!image_var}" >/dev/null
done
deadline=$((SECONDS + 90))
until docker exec "$id-core" bun -e "fetch('http://localhost:8080/api/health/live').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))" >/dev/null 2>&1; do
  (( SECONDS < deadline )) || { echo 'Core image timed out'; exit 1; }
  sleep 1
done
# Each container answers on its own, as Pangolin reaches it: no Host routing inside.
docker exec "$id-core" bun -e '
for (const [url,type] of [["http://auth/","text/html"],["http://admin/","text/html"],["http://workspace/","text/html"],["http://engineering/engineering","text/html"],["http://localhost:8080/api/health/live","application/json"]]) {
  const r = await fetch(url);
  if(r.status!==200 || !r.headers.get("content-type")?.startsWith(type)) throw new Error(url+": "+r.status);
  console.log("PASS "+url);
}'
# Every SPA is unframable and runs no script but its own files and the hashed inline ones its shell carries.
docker exec "$id-core" bun -e '
const { createHash } = require("node:crypto");
for (const url of ["http://auth/","http://admin/identity-access/work-queue","http://workspace/","http://engineering/engineering"]) {
  const r = await fetch(url);
  const h = (name) => r.headers.get(name) ?? "";
  const csp = h("content-security-policy");
  const scriptSrc = csp.match(/(?:^|;)\s*script-src ([^;]*)/)?.[1].trim().split(/\s+/) ?? [];
  const inline = [...(await r.text()).matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(([, body]) => "\x27sha256-" + createHash("sha256").update(body).digest("base64") + "\x27");
  const problems = [
    !/(?:^|;)\s*frame-ancestors \x27none\x27/.test(csp) && "frame-ancestors",
    h("x-frame-options") !== "DENY" && "X-Frame-Options",
    h("x-content-type-options") !== "nosniff" && "nosniff",
    !h("referrer-policy") && "Referrer-Policy",
    /unsafe-eval/.test(csp) && "unsafe-eval",
    scriptSrc[0] !== "\x27self\x27" && "script-src self",
    scriptSrc.slice(1).some((s) => !s.startsWith("\x27sha256-")) && "script-src beyond hashes",
    (!inline.length || inline.some((s) => !scriptSrc.includes(s))) && "unhashed inline script",
  ].filter(Boolean);
  if (problems.length) throw new Error(url+": "+problems.join(", ")+"\n"+csp);
  console.log("PASS headers "+url);
}'
# Sign in the way the door does (API host, auth. origin), then read the session as app. does.
password=$(sed -n 's/^Temporary password.*: //p' "$tmp/bootstrap")
docker exec -e PASSWORD="$password" "$id-core" bun -e '
const signIn = await fetch("http://localhost:8080/api/auth/sign-in/email", {
  method: "POST",
  headers: { host: "dev.tagaroa.cc", origin: "https://auth.dev.tagaroa.cc", "content-type": "application/json" },
  body: JSON.stringify({ email: "first-admin@fixture.invalid", password: process.env.PASSWORD }),
});
const session = signIn.headers.getSetCookie().find((c) => c.startsWith("__Host-better-auth.session_token="));
if (!signIn.ok || !session || /; Domain=/i.test(session) || !/; Secure/i.test(session) || !/; Path=\/(;|$)/i.test(session)) throw new Error("sign-in cookie: " + signIn.status + " " + session);
const r = await fetch("http://localhost:8080/api/auth/get-session", {
  headers: { host: "dev.tagaroa.cc", origin: "https://app.dev.tagaroa.cc", cookie: session.split(";")[0] },
});
if ((await r.json())?.user?.email !== "first-admin@fixture.invalid") throw new Error("no session on the API host");
console.log("PASS sign-in sets a host-only __Host- session cookie on dev.tagaroa.cc");'
echo 'PASS: image migrations, first-admin bootstrap, preflight refusal, core and app containers, SPA security headers, host-only session'
