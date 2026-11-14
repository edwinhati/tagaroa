#!/bin/bash
# plan-images.sh with stubbed changesets and registry.
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin"
for dir in servers/core apps/auth apps/admin apps/workspace domains/engineering; do
  mkdir -p "$tmp/$dir"
  echo '{"version":"0.1.0"}' > "$tmp/$dir/package.json"
done
# The snapshot: auth has a pending changeset.
cat > "$tmp/bin/bunx" <<'SH'
#!/bin/sh
echo '{"version":"0.1.1-alpha-abc1234"}' > apps/auth/package.json
SH
# The registry knows the tags listed in $KNOWN; $REGISTRY_DOWN makes every lookup fail.
cat > "$tmp/bin/docker" <<'SH'
#!/bin/sh
[ -z "${REGISTRY_DOWN:-}" ] || { echo 'dial tcp: i/o timeout' >&2; exit 1; }
grep -qxF "$3" "$KNOWN" && exit 0
echo "no such manifest: $3" >&2; exit 1
SH
chmod +x "$tmp/bin/"*
export PATH="$tmp/bin:$PATH" KNOWN="$tmp/known" SHA=0123456789abcdef0123456789abcdef01234567 REGISTRY=registry.test
cd "$tmp"
value() { sed -n "s/^$1=//p" "$GITHUB_OUTPUT"; }

# Released core, admin and workspace exist; engineering's 0.1.0 was never built.
printf 'registry.test/tagaroa/%s:0.1.0\n' core admin workspace > "$KNOWN"
export GITHUB_OUTPUT="$tmp/out1"
bash "$root/infra/ci/plan-images.sh" 2>/dev/null
[[ $(value core) == "" ]]
[[ $(value apps) == '[{"name":"auth","dir":"apps/auth","path":"","version":"0.1.1-alpha-abc1234"},{"name":"engineering","dir":"domains/engineering","path":"/engineering","version":"0.1.0"}]' ]]
sed -n '/^release<</,/^RELEASE_EOF$/p' "$GITHUB_OUTPUT" > "$tmp/release"
grep -qx "RELEASE_SHA=$SHA" "$tmp/release"
grep -qx 'AUTH_IMAGE=registry.test/tagaroa/auth:0.1.1-alpha-abc1234' "$tmp/release"
grep -qx 'ENGINEERING_IMAGE=registry.test/tagaroa/engineering:0.1.0' "$tmp/release"
[[ $(grep -c '_IMAGE=' "$tmp/release") == 5 ]]

# Nothing exists yet: core is built too.
: > "$KNOWN"
export GITHUB_OUTPUT="$tmp/out2"
bash "$root/infra/ci/plan-images.sh" 2>/dev/null
[[ $(value core) == 0.1.0 ]]

# A registry that cannot answer stops the plan instead of rebuilding released tags.
export GITHUB_OUTPUT="$tmp/out3" REGISTRY_DOWN=1
if bash "$root/infra/ci/plan-images.sh" 2>/dev/null; then echo 'Planned builds with the registry down'; exit 1; fi
[[ ! -s "$GITHUB_OUTPUT" ]]
echo 'PASS: builds only missing tags, alpha for pending changesets, stops when the registry cannot answer'
