#!/bin/sh
# Self-check for precompress.ts: sh infra/web/precompress.test.sh
set -eu
dir=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

mkdir -p "$tmp/assets/nested"
i=0
while [ $i -lt 400 ]; do i=$((i + 1)); echo "export const value$i = 'repeated text compresses well';"; done > "$tmp/assets/nested/app.js"
cp "$tmp/assets/nested/app.js" "$tmp/_shell.html"
echo 'tiny();' > "$tmp/assets/tiny.js"
i=0
while [ $i -lt 20 ]; do i=$((i + 1)); echo "const small$i = 'x';"; done > "$tmp/assets/small.js"
head -c 4096 /dev/urandom > "$tmp/assets/noise.js"
# Compressible on purpose, so only the file type keeps it out.
cp "$tmp/assets/nested/app.js" "$tmp/assets/logo.png"

bun "$dir/precompress.ts" "$tmp" > /dev/null

# Text in nested folders gets a smaller copy that decompresses to the original.
for file in assets/nested/app.js _shell.html; do
  [ -f "$tmp/$file.br" ] || { echo "FAIL: no $file.br"; exit 1; }
  bun -e 'const z=require("node:zlib"); const [a,b]=process.argv.slice(1).map(p=>require("node:fs").readFileSync(p)); if (!z.brotliDecompressSync(b).equals(a) || b.length >= a.length) process.exit(1)' \
    "$tmp/$file" "$tmp/$file.br" || { echo "FAIL: $file.br is not a smaller copy of $file"; exit 1; }
done
# Tiny files, binaries and files Brotli cannot shrink keep no copy.
for file in assets/tiny.js assets/small.js assets/logo.png assets/noise.js; do
  [ ! -e "$tmp/$file.br" ] || { echo "FAIL: unexpected $file.br"; exit 1; }
done
echo "precompress ok"
