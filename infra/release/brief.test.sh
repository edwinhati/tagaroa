#!/bin/bash
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin"
cat > "$tmp/bin/multica" <<'SH'
#!/bin/sh
case "$*" in
  'label list'*) echo '[{"id":"release-label","name":"release"}]' ;;
  'issue list --status in_progress'*) echo '{"issues":[]}' ;;
  'issue list --status todo'*) cat "$ENVELOPE" ;;
  # Like the real CLI: a --description-file outside the working directory needs --allow-external-file.
  'issue create'*--description-file*|'issue update'*--description-file*)
    case "$*" in *--allow-external-file*) ;; *) echo 'path resolves outside the current working directory' >&2; exit 1 ;; esac
    case "$*" in 'issue create'*) echo create >> "$TRACE"; echo '{"id":"created"}' ;; *) echo "update $3" >> "$TRACE" ;; esac ;;
  'issue label add'*) echo "label $4" >> "$TRACE" ;;
  'issue metadata set'*) echo "metadata $4" >> "$TRACE" ;;
  *) echo "Unexpected Multica call: $*" >&2; exit 99 ;;
esac
SH
chmod +x "$tmp/bin/multica"
export PATH="$tmp/bin:$PATH" ENVELOPE="$tmp/envelope" TRACE="$tmp/trace"
unset PROD_HOST DRY_RUN
cd "$root"
printf '%s' '{"issues":[],"has_more":false}' > "$ENVELOPE"
bash infra/release/brief.sh HEAD
printf 'create\nlabel created\nmetadata created\n' > "$tmp/expected"
diff -u "$tmp/expected" "$TRACE"
: > "$TRACE"
printf '%s' '{"issues":[{"id":"unrelated","labels":[]},{"id":"existing","labels":[{"name":"release"}]},{"id":"later","labels":[{"name":"release"}]}],"has_more":false}' > "$ENVELOPE"
bash infra/release/brief.sh HEAD
printf 'update existing\nmetadata existing\n' > "$tmp/expected"
diff -u "$tmp/expected" "$TRACE"
echo 'PASS: empty envelope creates a brief; populated envelope updates the first release'
