// Prints a CSP source for each inline <script> in an SPA shell, for the
// Caddyfile's script-src. TanStack Start's shell inlines its router state, which
// changes every build, so the hashes are taken from the build, not written down.
import { createHash } from "node:crypto";

const html = await Bun.file(Bun.argv[2] ?? "").text();
const hashes = [
  ...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi),
].map(
  ([, body = ""]) =>
    `'sha256-${createHash("sha256").update(body).digest("base64")}'`,
);
if (!hashes.length) throw new Error(`No inline scripts in ${Bun.argv[2]}`);
process.stdout.write(hashes.join(" "));
