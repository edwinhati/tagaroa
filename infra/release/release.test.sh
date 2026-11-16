#!/bin/bash
# Self-test for release.sh, with every tool stubbed: nothing reaches a registry or the VM.
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin"
# A bare [[ ]] does not stop macOS's bash 3.2 under set -e.
check() { "$@" || { echo "Failed: $*"; exit 1; }; }
fails() { if "$@" > "$tmp/out" 2>&1; then echo "Expected a failure: $*"; cat "$tmp/out"; exit 1; fi; }
sha=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
cat > "$tmp/bin/git" <<'SH'
#!/bin/sh
case "$1" in
  rev-parse) echo "${HEAD_SHA:-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa}" ;;
  merge-base) exit "${OFF_MAIN:-0}" ;;
  *) echo "unexpected git $*" >&2; exit 99 ;;
esac
SH
cat > "$tmp/bin/docker" <<'SH'
#!/bin/sh
echo "docker $*" >> "$TRACE"
SH
cat > "$tmp/bin/skopeo" <<'SH'
#!/bin/sh
case "$1" in
  login) cat >/dev/null ;;
  inspect)
    case "$*" in
      *--override-arch*) echo "${IMAGE_ARCH:-arm64}" ;;
      *sin.ocir.io*) echo "${DEST_MANIFEST:-manifest-for-$(echo "$*" | sed 's/.*tagaroa\///; s/:.*//')}" ;;
      *) echo "manifest-for-$(echo "$*" | sed 's/.*tagaroa\///; s/:.*//')" ;;
    esac ;;
  *) echo "skopeo $*" >> "$TRACE" ;;
esac
SH
cat > "$tmp/bin/scp" <<'SH'
#!/bin/sh
echo "scp $*" >> "$TRACE"
SH
cat > "$tmp/bin/ssh" <<'SH'
#!/bin/sh
echo "ssh $*" >> "$TRACE"
case "$*" in
  *--rollback*) exit "${FAIL_ROLLBACK:-0}" ;;
  *deploy.sh*) cat > "$RELEASE_IN"; exit "${FAIL_DEPLOY:-0}" ;;
  *'smoke.sh tagaroa-prod'*) exit "${FAIL_SMOKE:-0}" ;;
esac
SH
cat > "$tmp/bin/curl" <<'SH'
#!/bin/sh
case "$*" in
  *tagaroa.cc/api/*) echo '200 application/json' ;;
  *auth.tagaroa.cc*) echo "200 ${VERIFY_TYPE:-text/html}" ;;
  *) echo 'unexpected curl' >&2; exit 99 ;;
esac
SH
chmod +x "$tmp/bin/"*
export PATH="$tmp/bin:$PATH" TRACE="$tmp/trace" RELEASE_IN="$tmp/release-in" GITHUB_OUTPUT="$tmp/output"
export OCIR_NAMESPACE=fixture OCIR_USERNAME=fixture OCIR_TOKEN=fixture REGISTRY_TOKEN=fixture
cd "$tmp"
version() { # dir name version
  mkdir -p "$tmp/$1"
  printf '{"name":"%s","version":"%s"}\n' "$2" "$3" > "$tmp/$1/package.json"
}
version servers/core @servers/core 0.2.0
version apps/auth @apps/auth 0.1.0
version apps/admin @apps/admin 0.1.0
version apps/workspace @apps/workspace 0.1.0
version domains/engineering @domains/engineering 0.1.0
promote() { : > "$TRACE"; : > "$GITHUB_OUTPUT"; bash "$root/infra/release/release.sh" promote "${1:-$sha}"; }

promote > /dev/null
grep -qF "skopeo copy --all --preserve-digests --retry-times 3 docker://registry.engineering.tagaroa.cc/tagaroa/core-service:0.2.0 docker://sin.ocir.io/fixture/tagaroa/core-service:0.2.0" "$TRACE"
grep -qF "docker://sin.ocir.io/fixture/tagaroa/engineering:0.1.0" "$TRACE"
if grep -q '^docker ' "$TRACE"; then echo 'Release rebuilt images'; exit 1; fi
grep -qx "RELEASE_SHA=$sha" "$GITHUB_OUTPUT"
grep -qx 'AUTH_IMAGE=sin.ocir.io/fixture/tagaroa/auth:0.1.0' "$GITHUB_OUTPUT"
check test "$(grep -c '_IMAGE=' "$GITHUB_OUTPUT")" = 5
grep -qx 'tags=@servers/core@0.2.0 @apps/auth@0.1.0 @apps/admin@0.1.0 @apps/workspace@0.1.0 @domains/engineering@0.1.0' "$GITHUB_OUTPUT"
# A short sha, a checkout of another commit or a commit off main never get copied.
for case in short HEAD_SHA=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb OFF_MAIN=1; do
  if [[ $case == short ]]; then fails promote aaaaaaa; else fails env "$case" bash "$root/infra/release/release.sh" promote "$sha"; fi
  if grep -q 'skopeo copy' "$TRACE"; then echo "Promoted despite $case"; exit 1; fi
done
# An alpha in package.json, no arm64 image, or a copy that differs from its source.
version apps/admin @apps/admin 0.1.1-alpha-abc1234
fails promote
grep -q 'admin has no released version' "$tmp/out"
version apps/admin @apps/admin 0.1.0
for case in IMAGE_ARCH=amd64 DEST_MANIFEST=tampered; do
  : > "$GITHUB_OUTPUT"
  fails env "$case" bash "$root/infra/release/release.sh" promote "$sha"
  if grep -q RELEASE_SHA "$GITHUB_OUTPUT"; then echo "Wrote a release despite $case"; exit 1; fi
done
echo 'PASS: promote copies released versions by digest, refuses an alpha, a sha off main, a missing arm64 image or a mismatched copy'

deploy() { : > "$TRACE"; : > "$GITHUB_OUTPUT"; RELEASE="RELEASE_SHA=$sha" bash "$root/infra/release/release.sh" deploy; }
deploy > /dev/null
grep -qx "RELEASE_SHA=$sha" "$RELEASE_IN"
grep -q 'smoke.sh tagaroa-prod' "$TRACE"
if grep -q -- --rollback "$TRACE"; then echo 'A good release rolled back'; exit 1; fi
# deploy.sh restores the previous images itself, so no second rollback.
export FAIL_DEPLOY=1
fails deploy
if grep -q -- --rollback "$TRACE"; then echo "Rolled back over deploy.sh's own restore"; exit 1; fi
if grep -q 'smoke.sh tagaroa-prod' "$TRACE"; then echo 'Checked a failed deploy'; exit 1; fi
unset FAIL_DEPLOY
# A failed check on the VM or in public rolls back; a failed rollback says so.
for case in FAIL_SMOKE=1 VERIFY_TYPE=text/plain; do
  export "${case?}"
  fails deploy
  grep -q -- --rollback "$TRACE"
  grep -qx rollback=done "$GITHUB_OUTPUT"
  unset "${case%%=*}"
done
export FAIL_SMOKE=1 FAIL_ROLLBACK=1
fails deploy
grep -q 'ROLLBACK FAILED' "$tmp/out"
grep -qx rollback=failed "$GITHUB_OUTPUT"
echo 'PASS: deploy, deploy.sh failure left to deploy.sh, rollback after a failed check, failed rollback reported'
