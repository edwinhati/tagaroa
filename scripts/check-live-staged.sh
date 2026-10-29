#!/bin/sh
# Impeccable Live injects `<ImpeccableLiveRoot />` and its import into each app's
# src/routes/__root.tsx for as long as `bun dev` runs, and gitignores the
# component that import points at. Staged, that is a tree nobody can build: the
# import resolves to a file no clone has. The injection belongs in the working
# tree, never in a commit.
#
# Checked against each file's staged *content*, not the diff, so one already
# committed dirty is caught on its next touch too. Only the injected paths are
# looked at — with-live.mjs and the ignore rules name the same symbols on
# purpose.
offenders=$(
  git diff --cached --name-only --diff-filter=ACM |
    grep -E '/src/(routes/__root\.tsx|components/ImpeccableLiveRoot\.tsx)$' |
    while IFS= read -r file; do
      git show ":$file" |
        grep -qE 'ImpeccableLiveRoot|impeccable-live-tanstack' &&
        echo "$file"
    done
)

if [ -n "$offenders" ]; then
  echo "pre-commit: impeccable live injection is staged in:" >&2
  echo "$offenders" | sed 's/^/  /' >&2
  echo "Stop the dev server (or run dev:plain once), then stage again." >&2
  exit 1
fi
