// Writes a Brotli copy (`<file>.br`) beside every compressible file in a
// built SPA, for the Caddyfile's `file_server { precompressed br }`. Compressing
// once at build time, at Brotli's best level, makes first loads smaller than
// per-request gzip and leaves Caddy nothing to compress. Clients without Brotli
// still get the Caddyfile's on-the-fly encoding.
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { brotliCompressSync, constants } from "node:zlib";

const COMPRESSIBLE = /\.(css|html|js|json|mjs|svg|txt|xml)$/;
// Below this, the headers outweigh what compression saves.
const MIN_BYTES = 1024;

const root = Bun.argv[2];
if (!root) throw new Error("usage: bun infra/web/precompress.ts <dist dir>");

let written = 0;
for (const name of await readdir(root, { recursive: true })) {
  if (!COMPRESSIBLE.test(name)) continue;
  const path = join(root, name);
  const original = await Bun.file(path).bytes();
  if (original.byteLength < MIN_BYTES) continue;
  const compressed = brotliCompressSync(original, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
      [constants.BROTLI_PARAM_SIZE_HINT]: original.byteLength,
    },
  });
  if (compressed.byteLength >= original.byteLength) continue;
  await Bun.write(`${path}.br`, compressed);
  written += 1;
}
console.log(`${root}: ${written} Brotli files`);
