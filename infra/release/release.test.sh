#!/bin/bash
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin" "$tmp/infra/release"
cp "$root/infra/release/log-tail.sh" "$tmp/infra/release/log-tail.sh"
cat > "$tmp/bin/multica" <<'SH'
#!/bin/sh
case "$*" in
  login*) exit 0 ;;
  'issue list'*) cat "$APPROVED" ;;
  'issue comment add'* | 'issue status'*) echo "$*" >> "$TRACE" ;;
  *) echo "Unexpected Multica call: $*" >&2; exit 99 ;;
esac
SH
for tool in docker skopeo ssh scp; do
  # TRACE is resolved by the generated fixture executable.
  # shellcheck disable=SC2016
  printf '#!/bin/sh\necho unsafe-%s >> "$TRACE"\nexit 99\n' "$tool" > "$tmp/bin/$tool"
done
cat > "$tmp/bin/git" <<'SH'
#!/bin/sh
case "$1" in merge-base) exit 0 ;; *) echo unsafe-git >> "$TRACE"; exit 99 ;; esac
SH
cat > "$tmp/bin/curl" <<'SH'
#!/bin/sh
echo '{"workflow_runs":[]}'
SH
chmod +x "$tmp/bin/"*
export PATH="$tmp/bin:$PATH" APPROVED="$tmp/approved" TRACE="$tmp/trace"
export RUNNER_TEMP="$tmp" MULTICA_TOKEN=fixture GITHUB_RUN_ID=1 GITHUB_RUN_ATTEMPT=1
export GITHUB_TOKEN=fixture GITHUB_API_URL=https://api.github.invalid GITHUB_REPOSITORY=fixture/repo
export RUN_URL=https://github.invalid/run/1
cd "$tmp"
printf '{"issues":[]}' > "$APPROVED"
bash "$root/infra/release/release.sh"
[[ ! -f "$TRACE" ]]
printf '%s' '{"issues":[{"id":"fixture-id","assignee_type":"agent","assignee_id":"fixture-agent","labels":[{"name":"release"}],"metadata":{"sha":"bad"}}]}' > "$APPROVED"
bash "$root/infra/release/release.sh"
[[ ! -f "$TRACE" ]]
for sha in bad aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa; do
  printf '{"issues":[{"id":"fixture-id","assignee_type":"member","assignee_id":"76553844-fcc5-4865-af41-a2bf607ed168","labels":[{"name":"release"}],"metadata":{"sha":"%s"}}]}' "$sha" > "$APPROVED"
  if bash "$root/infra/release/release.sh"; then echo 'Release gate incorrectly accepted invalid/QA-red SHA'; exit 1; fi
  grep -q 'issue status fixture-id blocked' "$TRACE"
  if grep -q unsafe "$TRACE"; then echo 'Release gate reached deployment'; exit 1; fi
done
echo 'PASS: no approval, agent assignment, invalid SHA and missing QA never deploy'
export HOME="$tmp/home" OCIR_NAMESPACE=fixture OCIR_USERNAME=fixture OCIR_TOKEN=fixture REGISTRY_TOKEN=fixture
export PROD_SSH_KEY=fixture PROD_SSH_KNOWN_HOSTS=fixture
mkdir -p "$HOME"
# The versions at the approved sha: core has a release since prod, the apps do not.
version() { # dir name version
  mkdir -p "$tmp/$1"
  printf '{"name":"%s","version":"%s"}\n' "$2" "$3" > "$tmp/$1/package.json"
}
version servers/core @servers/core 0.2.0
version apps/auth @apps/auth 0.1.0
version apps/admin @apps/admin 0.1.0
version apps/workspace @apps/workspace 0.1.0
version domains/engineering @domains/engineering 0.1.0
# No version is tagged yet; a tag or push lands in the trace.
cat > "$tmp/bin/git" <<'SH'
#!/bin/sh
case "$1" in
  rev-list) echo 1 ;;
  rev-parse) exit 1 ;;
  tag) echo "git $*" >> "$TRACE" ;;
  -c) echo "git push ${*##* push --quiet }" >> "$TRACE"; exit "${FAIL_PUSH:-0}" ;;
esac
SH
cat > "$tmp/bin/docker" <<'SH'
#!/bin/sh
case "$1" in login) cat >/dev/null ;; esac
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
      *) echo "manifest-for-$(echo "$*" | sed 's/.*tagaroa\///; s/:.*//; s/-prod$//')" ;;
    esac ;;
  *) echo "skopeo $*" >> "$TRACE" ;;
esac
SH
cat > "$tmp/bin/scp" <<'SH'
#!/bin/sh
exit 0
SH
cat > "$tmp/bin/ssh" <<'SH'
#!/bin/sh
echo "ssh $*" >> "$TRACE"
case "$*" in
  *'echo 1'*) echo 1 ;;
  *'sed -n'*) echo bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb ;;
  *--rollback*) exit 0 ;;
  *deploy.sh*) cat > "$RELEASE_IN"; exit "${FAIL_DEPLOY:-0}" ;;
esac
SH
cat > "$tmp/bin/curl" <<'SH'
#!/bin/sh
case "$*" in
  *workflow_runs* | *actions/workflows/qa.yml*) echo '{"workflow_runs":[{}]}' ;;
  *tagaroa.cc/api/*) echo '200 application/json' ;;
  *auth.tagaroa.cc*) echo "200 ${VERIFY_TYPE:-text/html}" ;;
  *engineering*) ;;
  *) echo '200 text/html' ;;
esac
SH
export RELEASE_IN="$tmp/release-in"
: > "$TRACE"
bash "$root/infra/release/release.sh"
grep -q 'issue status fixture-id done' "$TRACE"
if grep -q -- --rollback "$TRACE"; then echo 'Successful deploy rolled back'; exit 1; fi
sha=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
grep -qF "skopeo copy --all --preserve-digests --retry-times 3 docker://registry.engineering.tagaroa.cc/tagaroa/core:0.2.0 docker://sin.ocir.io/fixture/tagaroa/core:0.2.0" "$TRACE"
grep -qF "skopeo copy --all --preserve-digests --retry-times 3 docker://registry.engineering.tagaroa.cc/tagaroa/engineering:0.1.0 docker://sin.ocir.io/fixture/tagaroa/engineering:0.1.0" "$TRACE"
if grep -q '^docker ' "$TRACE"; then echo 'Release rebuilt images'; exit 1; fi
# The VM gets the sha and one image per deployable, on stdin.
grep -qx "RELEASE_SHA=$sha" "$RELEASE_IN"
grep -qx 'AUTH_IMAGE=sin.ocir.io/fixture/tagaroa/auth:0.1.0' "$RELEASE_IN"
[[ $(grep -c '_IMAGE=' "$RELEASE_IN") == 5 ]]
# Each released version is tagged on the sha and pushed.
grep -qx "git tag @servers/core@0.2.0 $sha" "$TRACE"
grep -qx "git tag @domains/engineering@0.1.0 $sha" "$TRACE"
grep -q '^git push .*refs/tags/@apps/auth@0.1.0' "$TRACE"
grep -q 'Released aaaaaaa: core 0.2.0, auth 0.1.0' "$TRACE"
# A tag push that fails still leaves the release done, and prod as it is.
: > "$TRACE"
FAIL_PUSH=1 bash "$root/infra/release/release.sh" > "$tmp/log"
grep -q 'issue status fixture-id done' "$TRACE"
grep -q '::warning::Released, but the version tags were not pushed' "$tmp/log"
if grep -q -- --rollback "$TRACE"; then echo 'A failed tag push rolled prod back'; exit 1; fi
# A pending changeset's alpha build never reaches prod.
version apps/admin @apps/admin 0.1.1-alpha-abc1234
: > "$TRACE"
if bash "$root/infra/release/release.sh"; then echo 'Released an alpha version'; exit 1; fi
grep -q 'issue status fixture-id blocked' "$TRACE"
if grep -q 'skopeo copy.*admin' "$TRACE"; then echo 'Copied an alpha image'; exit 1; fi
version apps/admin @apps/admin 0.1.0
# No arm64 image (a sha deployed before dev built for prod), or a copy that does
# not match its source: refuse before anything reaches prod.
for case in IMAGE_ARCH=amd64 DEST_MANIFEST=tampered; do
  : > "$TRACE"
  if env "$case" bash "$root/infra/release/release.sh"; then echo "Promotion accepted $case"; exit 1; fi
  grep -q 'issue status fixture-id blocked' "$TRACE"
  if grep -q 'deploy.sh' "$TRACE"; then echo "Deployed despite $case"; exit 1; fi
done
echo 'PASS: promotes released versions by digest and tags them; refuses an alpha, a missing arm64 image or a mismatched copy'
: > "$TRACE"
export FAIL_DEPLOY=1
if bash "$root/infra/release/release.sh"; then echo 'Failed deploy accepted'; exit 1; fi
grep -q 'issue status fixture-id blocked' "$TRACE"
if grep -q -- --rollback "$TRACE"; then echo 'Internal rollback was repeated against an older release'; exit 1; fi
: > "$TRACE"
export FAIL_DEPLOY=0 VERIFY_TYPE=text/plain
if bash "$root/infra/release/release.sh"; then echo 'Bad public verification accepted'; exit 1; fi
grep -q -- --rollback "$TRACE"
grep -q 'issue status fixture-id blocked' "$TRACE"
echo 'PASS: approved release, internal rollback preservation, public verification rollback'
