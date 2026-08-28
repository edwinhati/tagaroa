#!/usr/bin/env node
/**
 * Runs a frontend's dev command with impeccable live already attached.
 *
 * Usage, from any app under apps/:  node ../../scripts/with-live.mjs vite dev
 *
 * live.mjs injects a script tag into the app's document shell, so the injection
 * is removed again when the dev server exits — a Ctrl-C never leaves the tree
 * dirty. Set IMPECCABLE_LIVE=0 to skip live entirely (CI, or a plain run).
 *
 * ponytail: one helper on port 8400 is shared by every app, so two dev servers
 * at once will fight over it — first one wins, second runs without live. Give
 * the helper a per-app port if that ever becomes the normal way to work.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const impeccable = join(repoRoot, ".claude/skills/impeccable/scripts");
const appRoot = process.cwd();
const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error("with-live: no dev command given");
  process.exit(1);
}

const node = (script, scriptArgs) =>
  spawnSync(process.execPath, [join(impeccable, script), ...scriptArgs], {
    cwd: appRoot,
    encoding: "utf8",
  });

/** The shell impeccable injects into, per framework. Add cases as apps arrive. */
function liveConfig() {
  if (existsSync(join(appRoot, "src/routes/__root.tsx"))) {
    return {
      files: ["src/routes/__root.tsx"],
      insertBefore: "<Scripts",
      commentSyntax: "jsx",
      cspChecked: true,
    };
  }
  if (existsSync(join(appRoot, "index.html"))) {
    return {
      files: ["index.html"],
      insertBefore: "</body>",
      commentSyntax: "html",
      cspChecked: true,
    };
  }
  return null;
}

function boot() {
  let result = node("live.mjs", ["--target", "."]);
  let parsed = parse(result.stdout);

  if (parsed?.error === "config_missing") {
    const config = liveConfig();
    if (!config) return null;
    const path = parsed.path ?? join(appRoot, ".impeccable/live/config.json");
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
    result = node("live.mjs", ["--target", "."]);
    parsed = parse(result.stdout);
  }

  return parsed?.ok ? parsed : null;
}

function parse(stdout) {
  try {
    return JSON.parse(stdout ?? "");
  } catch {
    return null;
  }
}

function removeStaleTanStackImport() {
  const rootRoute = join(appRoot, "src/routes/__root.tsx");
  if (!existsSync(rootRoute)) return;
  const content = readFileSync(rootRoute, "utf8");
  const cleaned = content.replace(
    /^import\s+ImpeccableLiveRoot\s+from\s+["'][^"']*\/impeccable\/ImpeccableLiveRoot["'];?[ \t]*\r?\n/gm,
    "",
  );
  if (cleaned !== content) writeFileSync(rootRoute, cleaned);
}

removeStaleTanStackImport();
const live = process.env.IMPECCABLE_LIVE === "0" ? null : boot();

if (live) {
  console.log(`impeccable live attached (helper :${live.serverPort})`);
} else if (process.env.IMPECCABLE_LIVE !== "0") {
  console.log("impeccable live unavailable — starting dev without it");
}

let cleaned = false;
function cleanup() {
  if (cleaned || !live) return;
  cleaned = true;
  node("live-server.mjs", ["stop"]);
  removeStaleTanStackImport();
}

// No shell: the dev binary resolves through the PATH the package manager set.
const child = spawn(command, args, { cwd: appRoot, stdio: "inherit" });

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    cleanup();
    child.kill(signal);
  });
}

child.on("exit", (code, signal) => {
  cleanup();
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

process.on("exit", cleanup);
