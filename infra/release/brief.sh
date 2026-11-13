#!/usr/bin/env bash
# Usage: brief.sh <sha>   (from a full-history checkout; docs/ops/workflows/release-prod.md "Brief")
# Creates or rewrites the one open release issue (label `release`, status todo,
# assigned to edwinhati) so it describes everything between prod and <sha>.
# Env: RUN_URL (dev deploy run), QA_URL (optional), DRY_RUN=1 (print, change nothing),
#      MULTICA_PROJECT_ID (default: the Tagaroa project).
set -euo pipefail
S=$(git rev-parse "$1^{commit}")
short=${S:0:7}
repo=edwinhati/tagaroa
project=${MULTICA_PROJECT_ID:-2e3066f3-2cc4-4521-8444-729703e51986}

# The prod sha is the image tag in the VM's .release.env. No prod yet, or no way
# to ask (no key on this runner), means the brief covers all of main; the second
# case is said out loud so it is not mistaken for a first release.
note=""
P=""
if [[ -n ${PROD_HOST:-} ]]; then
  if out=$(ssh -o BatchMode=yes -o ConnectTimeout=10 "$PROD_HOST" 'if [ -f /home/tagaroa/apps/.release.env ]; then cat /home/tagaroa/apps/.release.env; fi'); then
    P=$(sed -n 's/^CORE_IMAGE=.*://p' <<<"$out")
  else
    echo "Cannot read prod release state; refusing to create a misleading brief." >&2
    exit 1
  fi
fi
if [[ -n $P ]]; then range="$P..$S"; tree=("$P" "$S"); else range=$S; tree=(4b825dc642cb6eb9a060e54bf8d69288fbee4904 "$S"); fi

commits=$(git rev-list --count "$range")

# Migrations: only new files can be additive; an edited or removed one never is.
migrations="" attention=""
while IFS=$'\t' read -r status file; do
  [[ $file == servers/core/drizzle/*.sql ]] || continue
  name=${file##*/}
  if [[ $status == A ]] && ! git show "$S:$file" | grep -qiE 'drop (table|column|schema|index|constraint)|rename|alter column|truncate|delete from|set not null|alter table .* type '; then
    migrations+="- \`$name\`: adds only"$'\n'
  else
    migrations+="- \`$name\`: **changes or removes existing schema**"$'\n'
    attention="**Needs a look:** a migration is not purely additive."$'\n\n'
  fi
done < <(git diff --name-status --no-renames "${tree[@]}")
migration_count=$(grep -c . <<<"$migrations" || true)
[[ -n $migrations ]] || migrations="None."$'\n'

# Config: keys added or removed in any .env.example. A new uncommented key is required.
config=""
while IFS= read -r line; do
  key=$(sed -E 's/^[+-]#? ?([A-Z][A-Z0-9_]*)=.*/\1/' <<<"$line")
  [[ $config == *"\`$key\` "* ]] && continue # the same key in several apps
  if [[ $line == +* ]]; then
    if [[ $line == "+#"* ]]; then config+="- \`$key\` added (optional)"$'\n'
    else config+="- \`$key\` added: **Needs a look**, prod's \`.env\` must have it before approval"$'\n'; attention="**Needs a look:** a new required config key."$'\n\n'; fi
  else
    config+="- \`$key\` removed"$'\n'
  fi
done < <(git diff -U0 "${tree[@]}" -- servers/core/.env.example 'apps/*/.env.example' 'domains/*/.env.example' | grep -E '^[+-]#? ?[A-Z][A-Z0-9_]*=' || true)
[[ -n $config ]] || config="None."$'\n'

changes=""
while read -r c; do
  subject=$(git show -s --format=%s "$c")
  issue=$(git show -s --format='%s %b' "$c" | grep -oE 'ISSUE-[0-9]+' | head -1 || true)
  [[ $subject == *"$issue"* ]] && issue="" # already in the subject
  if [[ $subject =~ ^(.*)\ \(#([0-9]+)\)$ ]]; then
    changes+="- [#${BASH_REMATCH[2]}](https://github.com/$repo/pull/${BASH_REMATCH[2]}) ${BASH_REMATCH[1]}${issue:+ ($issue)}"$'\n'
  else
    changes+="- $subject${issue:+ ($issue)}"$'\n'
  fi
done < <(git rev-list --no-merges "$range")
[[ -n $changes ]] || changes="None."$'\n'

links="- Dev deploy: ${RUN_URL:-n/a}"$'\n'
[[ -z ${QA_URL:-} ]] || links+="- QA: $QA_URL"$'\n'
links+="- Dev: https://app.dev.tagaroa.cc"

body=$(cat <<DESC
${note:+$note

}${attention}${commits} commit(s), ${migration_count} migration(s), dev healthy since $(date -u +'%Y-%m-%d %H:%M UTC')

**Migrations**
${migrations}
**Config**
${config}
**Changes**
${changes}
**Links**
${links}

Approve: set this issue to In Progress.
DESC
)
title="Release $short to prod"

if [[ ${DRY_RUN:-} == 1 ]]; then printf '%s\n\n%s\n' "$title" "$body"; exit 0; fi

# mktemp is outside the checkout, which the CLI only reads with --allow-external-file.
file=$(mktemp); trap 'rm -f "$file"' EXIT
printf '%s\n' "$body" > "$file"

label_id=$(multica label list --output json | jq -r '.[] | select(.name=="release") | .id' | head -1)
[[ -n $label_id ]] || label_id=$(multica label create --name release --color '#0ea5e9' --description 'A pending release to prod' --output json | jq -r .id)

# A running release owns its brief. The next dev deploy refreshes after it closes.
running=$(multica issue list --status in_progress --project "$project" --limit 100 --output json \
  | jq -r '[.issues[] | select(any(.labels[]?; .name=="release"))] | length')
if [[ "$running" != 0 ]]; then echo "A release is running; leaving its approved brief unchanged."; exit 0; fi
existing=$(multica issue list --status todo --limit 100 --output json \
  | jq -r --arg l release '[.issues[] | select(any(.labels[]?; .name==$l))][0].id // empty')
if [[ -n $existing ]]; then
  multica issue update "$existing" --title "$title" --description-file "$file" --allow-external-file >/dev/null
  issue=$existing
else
  issue=$(multica issue create --title "$title" --description-file "$file" --allow-external-file --assignee edwinhati \
    --status todo --project "$project" --output json | jq -r .id)
  multica issue label add "$issue" "$label_id" >/dev/null
fi
multica issue metadata set "$issue" --key sha --value "$S" --type string >/dev/null
echo "Release brief current: $issue ($short)"
