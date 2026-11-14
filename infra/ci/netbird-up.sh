#!/bin/bash
# Joins this GitHub-hosted runner to NetBird for one job, so it reaches the private
# registry and Multica. The setup key makes it an ephemeral peer in group "CI", which
# NetBird allows TCP 443 to those two only; the peer is removed about 10 minutes after
# the runner is gone. NetBird's DNS stays off: each name is pinned in /etc/hosts.
#
#   NETBIRD_SETUP_KEY=... bash infra/ci/netbird-up.sh <private ip>=<host>...
set -euo pipefail
: "${NETBIRD_SETUP_KEY:?netbird-up: NETBIRD_SETUP_KEY is required}"
version=0.83.1
case $(uname -m) in
  x86_64) arch=amd64 sum=a7c79ea3cb61029c5565277152e1c32cd3ccb5258dc35c86d8d3a5b5793b91da ;;
  aarch64) arch=arm64 sum=ba2dd9b96fda1443b851a3660037557c8e2289c45f7016926fccea5ee42b7411 ;;
  *) echo "netbird-up: no NetBird build pinned for $(uname -m)" >&2; exit 1 ;;
esac
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
curl -fsSL --retry 3 -o "$tmp/netbird.tar.gz" \
  "https://github.com/netbirdio/netbird/releases/download/v$version/netbird_${version}_linux_$arch.tar.gz"
echo "$sum  $tmp/netbird.tar.gz" | sha256sum -c --quiet -
tar -xzf "$tmp/netbird.tar.gz" -C "$tmp" netbird
sudo install -m 0755 "$tmp/netbird" /usr/local/bin/netbird
sudo netbird service install >/dev/null
sudo netbird service start >/dev/null
(umask 077 && printf '%s' "$NETBIRD_SETUP_KEY" > "$tmp/key")
sudo netbird up --management-url https://vpn.tagaroa.cc --setup-key-file "$tmp/key" \
  --hostname "gh-${GITHUB_RUN_ID:-local}-${GITHUB_JOB:-job}-$arch" \
  --disable-dns --block-inbound --disable-server-routes >/dev/null

for pair in "$@"; do
  ip=${pair%%=*} host=${pair#*=}
  echo "$ip $host" | sudo tee -a /etc/hosts >/dev/null
  for try in $(seq 30); do
    if timeout 2 bash -c "exec 3<>/dev/tcp/$ip/443" 2>/dev/null; then break; fi
    if ((try == 30)); then
      echo "netbird-up: $host ($ip) is unreachable after a minute" >&2
      sudo netbird status >&2 || true
      exit 1
    fi
    sleep 2
  done
  echo "Reached $host over NetBird."
done
