#!/bin/bash
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin" "$tmp/infra/ops"
cp "$root/infra/ops/ops-alert.sh" "$tmp/infra/ops/ops-alert.sh"
cat > "$tmp/bin/multica" <<'SH'
#!/bin/sh
case "$*" in
  login*) exit 0 ;;
  'issue list'*) cat "$APPROVED" ;;
  'issue comment add'* | 'issue status'*) echo "$*" >> "$TRACE" ;;
  *) echo "Unexpected Multica call: $*" >&2; exit 99 ;;
esac
SH
for tool in docker ssh scp; do
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
export HOME="$tmp/home" OCIR_NAMESPACE=fixture OCIR_USERNAME=fixture OCIR_TOKEN=fixture
export PROD_SSH_KEY=fixture PROD_SSH_KNOWN_HOSTS=fixture MULTICA_OPS_WEBHOOK=https://webhook.invalid
mkdir -p "$HOME"
cat > "$tmp/bin/git" <<'SH'
#!/bin/sh
case "$1" in rev-list) echo 1 ;; esac
SH
cat > "$tmp/bin/docker" <<'SH'
#!/bin/sh
case "$1" in login) cat >/dev/null ;; esac
echo "docker $*" >> "$TRACE"
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
  *deploy.sh*) exit "${FAIL_DEPLOY:-0}" ;;
esac
SH
cat > "$tmp/bin/curl" <<'SH'
#!/bin/sh
case "$*" in
  *workflow_runs* | *actions/workflows/qa.yml*) echo '{"workflow_runs":[{}]}' ;;
  *api.tagaroa.cc*) echo '200 application/json' ;;
  *auth.tagaroa.cc*) echo "200 ${VERIFY_TYPE:-text/html}" ;;
  *engineering*) ;;
  *webhook.invalid*) ;;
  *) echo '200 text/html' ;;
esac
SH
: > "$TRACE"
bash "$root/infra/release/release.sh"
grep -q 'issue status fixture-id done' "$TRACE"
if grep -q -- --rollback "$TRACE"; then echo 'Successful deploy rolled back'; exit 1; fi
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
