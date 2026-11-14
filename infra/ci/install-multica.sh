#!/bin/bash
# Installs the pinned Multica CLI on a GitHub-hosted amd64 runner.
#   bash infra/ci/install-multica.sh
set -euo pipefail
version=0.7.2
sum=5216eb619d5c2a244eeb0621711df9376a9c69cf757d8c133daf452d92d36007
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
curl -fsSL --retry 3 -o "$tmp/multica.tar.gz" \
  "https://github.com/multica-ai/multica/releases/download/v$version/multica-cli-$version-linux-amd64.tar.gz"
echo "$sum  $tmp/multica.tar.gz" | sha256sum -c --quiet -
sudo tar -xzf "$tmp/multica.tar.gz" -C /usr/local/bin multica
