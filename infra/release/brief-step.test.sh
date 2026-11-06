#!/bin/bash
# Self-check: Multica reporting failures in the dev brief step warn without failing the
# run, and production approval still fails closed. Stubs only: bash infra/release/brief-step.test.sh
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin"
cat > "$tmp/bin/multica" <<'SH'
#!/bin/sh
case "$*" in
  login*) [ "${LOGIN:-ok}" = ok ] && exit 0; echo "Could not sign in with that token" >&2; exit 3 ;;
  *) echo "unexpected multica call: $*" >> "$TRACE"; exit 99 ;;
esac
SH
for tool in docker skopeo ssh scp git curl; do
  # TRACE is resolved by the generated fixture executable.
  # shellcheck disable=SC2016
  printf '#!/bin/sh\necho unsafe-%s >> "$TRACE"\nexit 99\n' "$tool" > "$tmp/bin/$tool"
done
chmod +x "$tmp/bin/"*
cat > "$tmp/brief.sh" <<'SH'
#!/bin/bash
echo "brief ran for $1"
[ "${BRIEF:-ok}" = ok ]
SH
export PATH="$tmp/bin:$PATH" TRACE="$tmp/trace" BRIEF_SH="$tmp/brief.sh" SHA=abc123
export MULTICA_TOKEN=mul_s3cret LOG="$tmp/log" GITHUB_OUTPUT="$tmp/out"
step() { : > "$LOG"; : > "$GITHUB_OUTPUT"; env "$@" bash "$root/infra/release/brief-step.sh" > "$tmp/stdout" 2>&1; }

# Good brief: quiet success, nothing to alert.
step LOGIN=ok BRIEF=ok
grep -q 'brief ran for abc123' "$tmp/stdout"
if grep -q warning "$tmp/stdout" || [ -s "$GITHUB_OUTPUT" ]; then echo "FAIL: good brief warned"; exit 1; fi

# Rejected token: exit 0, warning, alert flag, diagnostics kept, brief.sh not run.
step LOGIN=fail BRIEF=ok
grep -q '::warning::Release brief not updated (exit 3)' "$tmp/stdout"
grep -q 'Could not sign in' "$LOG"
if grep -q 'brief ran' "$tmp/stdout"; then echo "FAIL: brief.sh ran after login failed"; exit 1; fi
grep -qx 'failed=true' "$GITHUB_OUTPUT"

# brief.sh failure: same, with its output in the log.
step LOGIN=ok BRIEF=fail
grep -q '::warning::Release brief not updated (exit 1)' "$tmp/stdout"
grep -q 'brief ran for abc123' "$LOG"
grep -qx 'failed=true' "$GITHUB_OUTPUT"

# The token never reaches the output or the log.
if grep -rq 'mul_s3cret' "$tmp/stdout" "$LOG"; then echo "FAIL: token leaked"; exit 1; fi

# Internal misuse is still fatal.
if env -u SHA bash "$root/infra/release/brief-step.sh" >/dev/null 2>&1; then echo "FAIL: missing SHA accepted"; exit 1; fi

# Production fails closed: no continue-on-error anywhere in release-prod.yml, and a
# Multica error in release.sh stops before any deploy tool runs.
if grep -q 'continue-on-error' "$root/.github/workflows/release-prod.yml"; then echo "FAIL: release-prod.yml must not tolerate failure"; exit 1; fi
: > "$TRACE"
if LOGIN=fail RUNNER_TEMP="$tmp" bash "$root/infra/release/release.sh" >/dev/null 2>&1; then echo "FAIL: release.sh continued after Multica login failed"; exit 1; fi
[ ! -s "$TRACE" ]

# The deploy job itself stays fatal: only the brief job is allowed to tolerate failure.
if sed -n '/^  deploy:/,/^  brief:/p' "$root/.github/workflows/deploy-dev.yml" | grep -q 'continue-on-error'; then echo "FAIL: deploy job must not tolerate failure"; exit 1; fi
echo "brief-step ok: reporting failures warn; deploy and production approval still fail closed"
