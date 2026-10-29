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
 * Each app gets its own Live helper port. That matters under `turbo run dev`,
 * where the microfrontend apps start together and must keep separate sessions.
 */
import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const impeccable = join(repoRoot, ".claude/skills/impeccable/scripts");
const appRoot = process.cwd();
const [command, ...args] = process.argv.slice(2);
const bootLock = join(repoRoot, ".impeccable/live-boot.lock");

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

const pause = (milliseconds) =>
  Atomics.wait(
    new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT)),
    0,
    0,
    milliseconds,
  );

const processExists = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code !== "ESRCH";
  }
};

function acquireBootLock() {
  mkdirSync(dirname(bootLock), { recursive: true });
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      writeFileSync(bootLock, String(process.pid), { flag: "wx" });
      return true;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      let owner = Number.NaN;
      try {
        owner = Number(readFileSync(bootLock, "utf8"));
      } catch (readError) {
        if (readError?.code !== "ENOENT") throw readError;
      }
      if (!Number.isInteger(owner) || !processExists(owner)) {
        try {
          unlinkSync(bootLock);
        } catch (unlinkError) {
          if (unlinkError?.code !== "ENOENT") throw unlinkError;
        }
        continue;
      }
      pause(10);
    }
  }
  return false;
}

function releaseBootLock() {
  try {
    if (readFileSync(bootLock, "utf8") === String(process.pid)) {
      unlinkSync(bootLock);
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function bootUnlocked() {
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

function boot() {
  if (!acquireBootLock()) return null;
  try {
    return bootUnlocked();
  } finally {
    releaseBootLock();
  }
}

function parse(stdout) {
  try {
    return JSON.parse(stdout ?? "");
  } catch {
    return null;
  }
}

// Path-agnostic and quote-agnostic: the adapter owns which folder it writes the
// component to, and a formatter may have rewritten its quotes since.
const LIVE_IMPORT_RE =
  /^import\s+ImpeccableLiveRoot\s+from\s+["'][^"']*["'];?[ \t]*\r?\n/gm;
const LIVE_BLOCK_RE =
  /^[ \t]*\{\/\* impeccable-live-tanstack-start \*\/\}\r?\n[\s\S]*?^[ \t]*\{\/\* impeccable-live-tanstack-end \*\/\}\r?\n?/gm;

/** Strips the given managed patterns from the root route, if it has any. */
function stripRootRoute(...patterns) {
  const rootRoute = join(appRoot, "src/routes/__root.tsx");
  if (!existsSync(rootRoute)) return;
  const content = readFileSync(rootRoute, "utf8");
  const cleaned = patterns.reduce((text, re) => text.replace(re, ""), content);
  if (cleaned !== content) writeFileSync(rootRoute, cleaned);
}

function removeStaleTanStackInjection() {
  stripRootRoute(LIVE_IMPORT_RE, LIVE_BLOCK_RE);

  const component = join(appRoot, "src/components/ImpeccableLiveRoot.tsx");
  try {
    if (
      readFileSync(component, "utf8").startsWith(
        "/* impeccable-live-tanstack-start */",
      )
    ) {
      unlinkSync(component);
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const injectionJournal = join(
    appRoot,
    ".impeccable/live/inject-journal.json",
  );
  if (existsSync(injectionJournal)) unlinkSync(injectionJournal);
}

const liveDisabled = process.env.IMPECCABLE_LIVE === "0";

// A plain run must not inherit a dead Live mount. A Live-enabled run leaves
// existing managed artifacts alone so live.mjs can update them in place — all
// but the import, which is re-added on every boot and so must not survive one.
if (liveDisabled) {
  node("live-server.mjs", ["stop"]);
  removeStaleTanStackInjection();
} else {
  // The adapter re-adds its import only when the exact single-quoted statement
  // is absent, so a leftover it can no longer recognise — a formatter reflowed
  // it, or a killed run left it behind — becomes a second declaration and the
  // dev server dies on `ImpeccableLiveRoot has already been declared`.
  stripRootRoute(LIVE_IMPORT_RE);
}

const live = liveDisabled ? null : boot();
// `bun dev` keeps this process for the whole session. The bridge is a
// separate Node program, so editing it does nothing until that process is
// replaced. It exits 0 when its script changes; start the next one here.
let bridge = null;
let cleaned = false;
function startBridge() {
  const child = spawn(
    process.execPath,
    [join(repoRoot, "scripts/live-bridge.mjs")],
    {
      cwd: repoRoot,
      stdio: "inherit",
    },
  );
  bridge = child;
  child.on("exit", (code) => {
    if (bridge !== child) return;
    bridge = null;
    if (cleaned || code !== 0) return;
    setTimeout(() => {
      if (!cleaned) startBridge();
    }, 300);
  });
}
if (live) startBridge();

if (live) {
  console.log(`impeccable live attached (helper :${live.serverPort})`);
} else if (!liveDisabled) {
  // live.mjs may inject before a later boot step fails. Do not start Vite with
  // half an injection, which renders <ImpeccableLiveRoot /> without its import.
  removeStaleTanStackInjection();
  console.log("impeccable live unavailable — starting dev without it");
}

function cleanup() {
  if (cleaned) return;
  cleaned = true;
  bridge?.kill("SIGTERM");
  if (live) node("live-server.mjs", ["stop"]);
  removeStaleTanStackInjection();
}

// No shell: the dev binary resolves through the PATH the package manager set.
const child = spawn(command, args, {
  cwd: appRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    VITE_IMPECCABLE_BRIDGE_PORT: process.env.IMPECCABLE_BRIDGE_PORT || "8410",
  },
});

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
