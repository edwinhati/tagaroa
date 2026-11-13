#!/bin/sh
# Prints a log's last 50 lines with secrets scrubbed, for the comment release.sh leaves
# on a failed release. Never pass a .env file.
#
#   sh infra/release/log-tail.sh FILE
set -eu
[ $# -eq 1 ] || { echo "log-tail: usage: log-tail.sh FILE" >&2; exit 2; }

# A plain assignment, so set -e stops here when the log cannot be read.
lines=$(tail -n 50 -- "$1")

# Credentials in URLs, bearer tokens and known token prefixes. After a secret-looking key
# (key=value, key: value) the rest of the line goes, so no part of a quoted or listed value leaks.
printf '%s\n' "$lines" | sed -E \
  -e 's#(://)[^/@[:space:]]+@#\1***@#g' \
  -e 's#(([Aa]uthorization|[Cc]ookie)"?[[:space:]]*[:=][[:space:]]*).*#\1***#' \
  -e 's#([Bb]earer[[:space:]]+)[^[:space:]"]+#\1***#g' \
  -e 's#([A-Za-z0-9_]*([Ss][Ee][Cc][Rr][Ee][Tt]|[Tt][Oo][Kk][Ee][Nn]|[Pp][Aa][Ss][Ss][Ww]?[Oo]?[Rr]?[Dd]|[Aa][Pp][Ii]_?[Kk][Ee][Yy]|[Pp][Rr][Ii][Vv][Aa][Tt][Ee]_?[Kk][Ee][Yy])[A-Za-z0-9_]*"?[[:space:]]*[:=][[:space:]]*).*#\1***#' \
  -e 's#(^|[^A-Za-z0-9])(mul|re|ghp|gho|ghs|github_pat)_[A-Za-z0-9_]{8,}#\1\2_***#g'
