import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = join(dirname(fileURLToPath(import.meta.url)), "with-live.mjs");

test("plain dev removes a stale TanStack Live injection", () => {
  const appRoot = mkdtempSync(join(tmpdir(), "tagaroa-with-live-"));
  const routes = join(appRoot, "src/routes");
  const components = join(appRoot, "src/components");
  mkdirSync(routes, { recursive: true });
  mkdirSync(components, { recursive: true });

  const rootRoute = join(routes, "__root.tsx");
  writeFileSync(
    rootRoute,
    `import ImpeccableLiveRoot from "../components/ImpeccableLiveRoot";
export function RootDocument() {
  return <body>
    {/* impeccable-live-tanstack-start */}
    <ImpeccableLiveRoot />
    {/* impeccable-live-tanstack-end */}
  </body>;
}
`,
  );
  writeFileSync(
    join(components, "ImpeccableLiveRoot.tsx"),
    "/* impeccable-live-tanstack-start */\nexport default function ImpeccableLiveRoot() { return null; }\n",
  );
  const liveState = join(appRoot, ".impeccable/live");
  mkdirSync(liveState, { recursive: true });
  const injectionJournal = join(liveState, "inject-journal.json");
  writeFileSync(
    injectionJournal,
    JSON.stringify({
      version: 1,
      artifacts: [
        {
          kind: "created",
          path: "src/components/ImpeccableLiveRoot.tsx",
        },
      ],
    }),
  );

  const result = spawnSync(
    process.execPath,
    [script, process.execPath, "-e", ""],
    {
      cwd: appRoot,
      env: { ...process.env, IMPECCABLE_LIVE: "0" },
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0, result.stderr);
  const source = readFileSync(rootRoute, "utf8");
  assert.doesNotMatch(source, /ImpeccableLiveRoot|impeccable-live-tanstack/);
  assert.equal(existsSync(join(components, "ImpeccableLiveRoot.tsx")), false);
  assert.equal(existsSync(injectionJournal), false);
});

test("a failed Live boot is cleaned before the dev command starts", () => {
  const appRoot = mkdtempSync(join(tmpdir(), "tagaroa-with-live-failure-"));
  const routes = join(appRoot, "src/routes");
  mkdirSync(routes, { recursive: true });
  const rootRoute = join(routes, "__root.tsx");
  writeFileSync(
    rootRoute,
    `import ImpeccableLiveRoot from "../components/ImpeccableLiveRoot";
export function RootDocument() {
  return <body>
    {/* impeccable-live-tanstack-start */}
    <ImpeccableLiveRoot />
    {/* impeccable-live-tanstack-end */}
    <Scripts />
  </body>;
}
`,
  );

  const assertion = `
    const { readFileSync } = require("node:fs");
    const source = readFileSync("src/routes/__root.tsx", "utf8");
    if (/ImpeccableLiveRoot|impeccable-live-tanstack/.test(source)) process.exit(7);
  `;
  const result = spawnSync(
    process.execPath,
    [script, process.execPath, "-e", assertion],
    { cwd: appRoot, encoding: "utf8" },
  );

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /live unavailable/);
  assert.doesNotMatch(
    readFileSync(rootRoute, "utf8"),
    /ImpeccableLiveRoot|impeccable-live-tanstack/,
  );
});
