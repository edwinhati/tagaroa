#!/bin/bash
# Self-check for netbird-up.sh with curl, uname and sudo stubbed: bash infra/ci/netbird-up.test.sh
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin"
cat > "$tmp/bin/uname" <<'SH'
#!/bin/sh
echo x86_64
SH
# A well-formed archive with a fake binary, so only the checksum can stop it.
mkdir -p "$tmp/fake" && echo 'echo pwned' > "$tmp/fake/netbird"
tar -czf "$tmp/fake.tar.gz" -C "$tmp/fake" netbird
cat > "$tmp/bin/curl" <<'SH'
#!/bin/sh
echo "curl $*" >> "$TRACE"
while [ $# -gt 0 ]; do [ "$1" = -o ] && { shift; cp "$FAKE" "$1"; }; shift; done
SH
cat > "$tmp/bin/sudo" <<'SH'
#!/bin/sh
echo "sudo $*" >> "$TRACE"
SH
chmod +x "$tmp/bin/"*
export PATH="$tmp/bin:$PATH" TRACE="$tmp/trace" FAKE="$tmp/fake.tar.gz"
cd "$root"

# No key: stop before downloading anything.
: > "$TRACE"
if env -u NETBIRD_SETUP_KEY bash infra/ci/netbird-up.sh 10.0.0.1=example.test >/dev/null 2>&1; then
  echo "FAIL: ran without a setup key"; exit 1
fi
[[ ! -s $TRACE ]] || { echo "FAIL: acted without a setup key"; cat "$TRACE"; exit 1; }

# A download that does not match the pinned checksum is never installed or run.
: > "$TRACE"
if NETBIRD_SETUP_KEY=k bash infra/ci/netbird-up.sh 10.0.0.1=example.test >/dev/null 2>&1; then
  echo "FAIL: accepted a tampered download"; exit 1
fi
grep -q 'netbird_0\.83\.1_linux_amd64\.tar\.gz' "$TRACE" || { echo "FAIL: wrong download"; cat "$TRACE"; exit 1; }
if grep -q '^sudo' "$TRACE"; then echo "FAIL: ran sudo after a checksum mismatch"; cat "$TRACE"; exit 1; fi
echo 'PASS: needs a setup key, and refuses a NetBird download that does not match the pinned checksum'
