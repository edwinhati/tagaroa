#!/bin/bash
# Self-check for approve.sh with multica and gh stubbed: bash infra/release/approve.test.sh
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin"
cat > "$tmp/bin/multica" <<'SH'
#!/bin/sh
case "$*" in
  'issue list --status todo'*) cat "$ENVELOPE" ;;
  'issue status'*) echo "status $3 $4" >> "$TRACE" ;;
  *) echo "Unexpected Multica call: $*" >&2; exit 99 ;;
esac
SH
cat > "$tmp/bin/gh" <<'SH'
#!/bin/sh
echo "gh $*" >> "$TRACE"
SH
chmod +x "$tmp/bin/"*
export PATH="$tmp/bin:$PATH" ENVELOPE="$tmp/envelope" TRACE="$tmp/trace"
unset GITHUB_REPOSITORY MULTICA_PROJECT_ID
cd "$root"

# No brief, or two: refuse and change nothing.
for envelope in '{"issues":[{"id":"other","labels":[]}],"has_more":false}' \
  '{"issues":[{"id":"a","labels":[{"name":"release"}]},{"id":"b","labels":[{"name":"release"}]}],"has_more":false}'; do
  printf '%s' "$envelope" > "$ENVELOPE"; : > "$TRACE"
  if bash infra/release/approve.sh --yes >/dev/null 2>&1; then echo "FAIL: approved $envelope"; exit 1; fi
  [[ ! -s $TRACE ]] || { echo "FAIL: changed something for $envelope"; cat "$TRACE"; exit 1; }
done

# Declined at the prompt: nothing changes.
printf '%s' '{"issues":[{"id":"other","labels":[]},{"id":"brief","title":"Release abc1234 to prod","labels":[{"name":"release"}]}],"has_more":false}' > "$ENVELOPE"
: > "$TRACE"
if echo n | bash infra/release/approve.sh >/dev/null 2>&1; then echo "FAIL: declined but approved"; exit 1; fi
[[ ! -s $TRACE ]] || { echo "FAIL: declined but changed"; exit 1; }

# One brief: approve it, then dispatch the release on main.
bash infra/release/approve.sh --yes >/dev/null
printf 'status brief in_progress\ngh workflow run release-prod.yml --repo edwinhati/tagaroa --ref main\n' > "$tmp/expected"
diff -u "$tmp/expected" "$TRACE"
echo 'PASS: approves the single open brief, then dispatches release-prod; refuses none, several or a declined prompt'
