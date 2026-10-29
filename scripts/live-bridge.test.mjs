import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const scripts = dirname(fileURLToPath(import.meta.url));
const skill = join(scripts, "../.agents/skills/impeccable");
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

/** Starts a bridge and resolves once it listens — which a standby only does after taking over. */
function startBridge(bridgeScript, env = {}) {
  const child = spawn(process.execPath, [bridgeScript], {
    cwd: join(dirname(bridgeScript), ".."),
    env: {
      ...process.env,
      IMPECCABLE_BRIDGE_PORT: "0",
      // Don't adopt a session file left by a real `bun dev` in this repo.
      IMPECCABLE_BRIDGE_RESUME: "0",
      // The panel embeds ttyd for a real agent terminal. Tests drive the
      // agent through a pipe unless a case opts in.
      IMPECCABLE_BRIDGE_TTYD: "0",
      IMPECCABLE_BRIDGE_RELOAD: "0",
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const listening = new Promise((resolve, reject) => {
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
      const match = output.match(/http:\/\/localhost:(\d+)/);
      if (match) resolve(`http://localhost:${match[1]}`);
    });
    child.on("error", reject);
    child.on("exit", (code) => reject(new Error(`Bridge exited ${code}`)));
  });
  return { child, listening };
}

async function stop(child) {
  if (child.exitCode !== null || child.signalCode) return;
  child.kill("SIGTERM");
  await once(child, "exit");
}

test("bridge serves its dashboard and rejects invalid connections", async () => {
  const { child, listening } = startBridge(join(scripts, "live-bridge.mjs"));
  let second;
  try {
    const base = await listening;
    const port = new URL(base).port;
    // localhost resolves to ::1 before 127.0.0.1. A browser refresh follows
    // that order and treats a refused::1 as the bridge being gone.
    const v4 = await fetch(`http://127.0.0.1:${port}/api/status`);
    assert.equal(v4.status, 200);
    const v6 = await fetch(`http://[::1]:${port}/api/status`);
    assert.equal(v6.status, 200);
    const page = await fetch(base);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Impeccable Bridge/);

    const status = await (await fetch(`${base}/api/status`)).json();
    assert.ok(status.apps.includes("apps/admin"));
    assert.equal(status.repoRoot, join(scripts, ".."));
    assert.equal(status.state.phase, "idle");

    const invalid = await fetch(`${base}/api/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app: "apps/missing", agent: "cursor" }),
    });
    assert.equal(invalid.status, 400);

    const empty = await fetch(`${base}/api/connect`, {
      method: "POST",
      body: "null",
    });
    assert.equal(empty.status, 400);

    const foreign = await fetch(`${base}/api/connect`, {
      method: "POST",
      headers: {
        Origin: "https://elsewhere.example",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ app: "apps/admin", agent: "cursor" }),
    });
    assert.equal(foreign.status, 403);

    const appOrigin = "http://localhost:3003";
    const preflight = await fetch(`${base}/api/connect`, {
      method: "OPTIONS",
      headers: {
        Origin: appOrigin,
        "Access-Control-Request-Method": "POST",
      },
    });
    assert.equal(preflight.status, 204);
    assert.equal(
      preflight.headers.get("access-control-allow-origin"),
      appOrigin,
    );
    const embeddedStatus = await fetch(`${base}/api/status`, {
      headers: { Origin: appOrigin },
    });
    assert.equal(embeddedStatus.status, 200);
    assert.equal(
      embeddedStatus.headers.get("access-control-allow-origin"),
      appOrigin,
    );

    // Every app's wrapper starts a bridge; the losers wait on the port so the
    // bridge outlives whichever app happened to win it.
    second = startBridge(join(scripts, "live-bridge.mjs"), {
      IMPECCABLE_BRIDGE_PORT: new URL(base).port,
    });
    await wait(500);
    assert.equal(second.child.exitCode, null);
    await stop(child);
    assert.equal(await second.listening, base);
    assert.equal((await fetch(`${base}/api/status`)).status, 200);
  } finally {
    await stop(child);
    if (second) await stop(second.child);
  }
});

test(
  "bridge keeps one agent session and survives the browser leaving Live",
  { skip: !existsSync(skill) && "impeccable skill not installed" },
  async () => {
    // A throwaway repo: the bridge resolves apps and Live scripts from its own path.
    const root = mkdtempSync(join(tmpdir(), "live-bridge-"));
    const app = join(root, "apps/demo");
    const bin = join(root, "bin");
    const agentLog = join(root, "agent.log");
    const offline = join(root, "offline");
    mkdirSync(join(root, "scripts"));
    mkdirSync(join(root, ".agents/skills"), { recursive: true });
    mkdirSync(app, { recursive: true });
    mkdirSync(bin);
    copyFileSync(
      join(scripts, "live-bridge.mjs"),
      join(root, "scripts/live-bridge.mjs"),
    );
    symlinkSync(skill, join(root, ".agents/skills/impeccable"));
    writeFileSync(
      join(app, "package.json"),
      JSON.stringify({ scripts: { dev: "node ../../scripts/with-live.mjs" } }),
    );
    writeFileSync(
      join(bin, "claude"),
      // Logs its argv; fails like a DNS blip once whenever `offline` exists.
      `#!${process.execPath}
const fs = require("node:fs");
fs.appendFileSync(${JSON.stringify(agentLog)}, JSON.stringify(process.argv.slice(2, -1)) + "\\n");
if (fs.existsSync(${JSON.stringify(offline)})) {
  fs.rmSync(${JSON.stringify(offline)});
  console.error("Error: [unavailable] getaddrinfo ENOTFOUND api2.cursor.sh");
  process.exit(1);
}
`,
    );
    chmodSync(join(bin, "claude"), 0o755);

    const live = spawn(
      process.execPath,
      [join(skill, "scripts/live-server.mjs")],
      { cwd: app, stdio: "ignore" },
    );
    const { child, listening } = startBridge(
      join(root, "scripts/live-bridge.mjs"),
      { PATH: `${bin}:${process.env.PATH}` },
    );
    const sse = new AbortController();
    try {
      let info;
      for (let i = 0; i < 100 && !info; i += 1) {
        await wait(100);
        try {
          info = JSON.parse(
            readFileSync(join(app, ".impeccable/live/server.json"), "utf8"),
          );
        } catch {
          // Not written yet.
        }
      }
      assert.ok(info, "Live server did not start");
      const liveBase = `http://127.0.0.1:${info.port}`;
      const base = await listening;
      const state = async () =>
        (await (await fetch(`${base}/api/status`)).json()).state;
      const until = async (check) => {
        for (let i = 0; i < 100; i += 1) {
          const current = await state();
          if (check(current)) return current;
          await wait(100);
        }
        return state();
      };
      const steer = (id) =>
        fetch(`${liveBase}/events`, {
          method: "POST",
          body: JSON.stringify({
            type: "steer",
            id,
            message: "Tighten it",
            token: info.token,
          }),
        });

      const stream = await fetch(`${liveBase}/events?token=${info.token}`, {
        signal: sse.signal,
      });
      void stream.body
        .getReader()
        .read()
        .catch(() => {});

      await fetch(`${base}/api/connect`, {
        method: "POST",
        body: JSON.stringify({ app: "apps/demo", agent: "claude" }),
      });
      const connected = await until((s) => s.phase === "waiting" && s.session);
      assert.match(connected.session, /^[0-9a-f-]{36}$/);
      assert.match(
        connected.resumeCommand,
        new RegExp(`/apps/demo' && claude --resume ${connected.session}$`),
      );

      const turns = async (count) => {
        for (let i = 0; i < 100; i += 1) {
          const lines = existsSync(agentLog)
            ? readFileSync(agentLog, "utf8").trim().split("\n")
            : [];
          if (lines.length >= count)
            return lines.map((line) => JSON.parse(line));
          await wait(100);
        }
        throw new Error(`Agent ran fewer than ${count} turns`);
      };
      assert.equal((await steer("a1b2c3d4")).status, 200);
      await turns(1);
      await until((s) => s.phase === "waiting");
      assert.equal((await steer("a1b2c3d5")).status, 200);
      assert.deepEqual(
        (await turns(2)).map((argv) => argv.slice(-2)),
        [
          ["--session-id", connected.session],
          ["--resume", connected.session],
        ],
      );

      // A network blip is retried on the same session instead of failing the action.
      await until((s) => s.phase === "waiting");
      writeFileSync(offline, "");
      assert.equal((await steer("a1b2c3d6")).status, 200);
      assert.deepEqual(
        (await turns(4)).slice(2).map((argv) => argv.slice(-2)),
        [
          ["--resume", connected.session],
          ["--resume", connected.session],
        ],
      );
      const retried = await until((s) => s.phase === "waiting");
      assert.ok(
        retried.history.some((h) =>
          /Claude Code couldn't reach its service/.test(h.message),
        ),
      );

      // Live queues `exit` 8s after the app's last tab lets go — moving to
      // another microfrontend or a slow reload. That is not a disconnect.
      sse.abort();
      await wait(9500);
      const after = await state();
      assert.equal(after.phase, "waiting");
      assert.equal(after.session, connected.session);
    } finally {
      sse.abort();
      await stop(child);
      await stop(live);
      rmSync(root, { recursive: true, force: true });
    }
  },
);

test(
  "bridge follows every Live app in the repo and keeps the session when its process is replaced",
  {
    skip: !existsSync(skill) && "impeccable skill not installed",
    timeout: 30_000,
  },
  async () => {
    // A git repo with two apps, each with its own Live helper — the shape
    // `turbo run dev` produces. The bridge used to poll only the app named at
    // Connect, so an action on the other app never reached the agent.
    // Node realpath's the spawn cwd (/var → /private/var). Roots must use that
    // path or every helper follows the repo pointer onto the same app.
    const root = realpathSync(mkdtempSync(join(tmpdir(), "live-bridge-repo-")));
    const bin = join(root, "bin");
    const agentLog = join(root, "agent.log");
    const hang = join(root, "hang");
    mkdirSync(join(root, "scripts"));
    mkdirSync(join(root, ".agents/skills"), { recursive: true });
    mkdirSync(bin);
    spawnSync("git", ["init"], { cwd: root, stdio: "ignore" });
    copyFileSync(
      join(scripts, "live-bridge.mjs"),
      join(root, "scripts/live-bridge.mjs"),
    );
    symlinkSync(skill, join(root, ".agents/skills/impeccable"));
    writeFileSync(
      join(bin, "claude"),
      `#!${process.execPath}
const fs = require("node:fs");
fs.appendFileSync(${JSON.stringify(agentLog)}, JSON.stringify({ cwd: process.cwd(), args: process.argv.slice(2) }) + "\\n");
process.stdout.write("bridge-visible\\n");
if (fs.existsSync(${JSON.stringify(hang)})) setInterval(() => {}, 1000);
`,
    );
    chmodSync(join(bin, "claude"), 0o755);

    const apps = ["apps/one", "apps/two", "apps/three"];
    for (const name of apps) {
      const app = join(root, name);
      mkdirSync(join(app, ".impeccable/live"), { recursive: true });
      writeFileSync(
        join(app, "package.json"),
        JSON.stringify({
          scripts: { dev: "node ../../scripts/with-live.mjs" },
        }),
      );
      writeFileSync(
        join(app, ".impeccable/live/roots.json"),
        JSON.stringify({
          version: 1,
          appRoot: app,
          repoRoot: root,
          contextRoot: null,
          sessionRoot: join(app, ".impeccable/live"),
          productPath: null,
          designPath: null,
          resolvedFrom: "test",
        }),
      );
    }
    mkdirSync(join(root, ".impeccable/live"), { recursive: true });
    writeFileSync(
      join(root, ".impeccable/live/app-root.json"),
      JSON.stringify({
        version: 2,
        appRoots: apps.map((name) => ({ appRoot: join(root, name) })),
      }),
    );

    const lives = new Map();
    const startLive = (name) => {
      const child = spawn(
        process.execPath,
        [join(skill, "scripts/live-server.mjs")],
        { cwd: join(root, name), stdio: "ignore" },
      );
      lives.set(name, child);
      return child;
    };
    const infoFor = async (name) => {
      const file = join(root, name, ".impeccable/live/server.json");
      for (let i = 0; i < 100; i += 1) {
        try {
          return JSON.parse(readFileSync(file, "utf8"));
        } catch {
          await wait(100);
        }
      }
      throw new Error(`Live server did not start for ${name}`);
    };
    const steer = async (name, id) => {
      const info = await infoFor(name);
      return fetch(`http://127.0.0.1:${info.port}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "steer",
          id,
          message: "Tighten it",
          token: info.token,
        }),
      });
    };
    const turns = async (count) => {
      for (let i = 0; i < 100; i += 1) {
        const lines = existsSync(agentLog)
          ? readFileSync(agentLog, "utf8").trim().split("\n").filter(Boolean)
          : [];
        if (lines.length >= count) return lines.map((line) => JSON.parse(line));
        await wait(100);
      }
      throw new Error(`Agent ran fewer than ${count} turns`);
    };

    // with-live serializes boots with a lock; starting the helpers together
    // races them onto one port and the loser never writes server.json.
    const bridgeEnv = {
      PATH: `${bin}:${process.env.PATH}`,
      IMPECCABLE_BRIDGE_RESUME: "1",
    };
    let first;
    let second;
    try {
      startLive("apps/one");
      await infoFor("apps/one");
      startLive("apps/two");
      await infoFor("apps/two");
      first = startBridge(join(root, "scripts/live-bridge.mjs"), bridgeEnv);
      const base = await first.listening;
      const state = async () =>
        (await (await fetch(`${base}/api/status`)).json()).state;
      const until = async (check) => {
        for (let i = 0; i < 100; i += 1) {
          const current = await state();
          if (check(current)) return current;
          await wait(100);
        }
        return state();
      };

      assert.equal(
        (
          await fetch(`${base}/api/connect`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ app: "apps/one", agent: "claude" }),
          })
        ).status,
        200,
      );
      const connected = await until((s) => s.phase === "waiting" && s.session);

      // The third app's helper comes up after Connect, the way turbo starts
      // packages at different times. It has to be picked up without reconnecting.
      startLive("apps/three");
      await infoFor("apps/three");
      const withThree = await until((s) => s.listening?.includes("apps/three"));
      assert.ok(
        withThree.listening?.includes("apps/three"),
        JSON.stringify(withThree.listening),
      );

      assert.equal((await steer("apps/two", "a1b2c3d4")).status, 200);
      const [firstTurn] = await turns(1);
      assert.equal(firstTurn.cwd, join(root, "apps/two"));
      assert.equal(firstTurn.args.at(-3), "--session-id");
      assert.equal(firstTurn.args.at(-2), connected.session);
      await until(
        (s) => s.phase === "waiting" && s.session === connected.session,
      );

      second = startBridge(join(root, "scripts/live-bridge.mjs"), {
        ...bridgeEnv,
        IMPECCABLE_BRIDGE_PORT: new URL(base).port,
      });
      await stop(first.child);
      assert.equal(await second.listening, base);
      const resumed = await until(
        (s) => s.phase === "waiting" && s.session === connected.session,
      );
      assert.equal(resumed.session, connected.session);

      assert.equal((await steer("apps/one", "a1b2c3d5")).status, 200);
      const resumedTurn = (await turns(2))[1];
      assert.equal(resumedTurn.cwd, join(root, "apps/one"));
      assert.equal(resumedTurn.args.at(-3), "--resume");
      assert.equal(resumedTurn.args.at(-2), connected.session);

      // Disconnect during a turn is the user leaving, not a failed connection.
      writeFileSync(hang, "");
      assert.equal((await steer("apps/two", "a1b2c3d6")).status, 200);
      const shown = await until(
        (s) => s.phase === "working" && s.output?.includes("bridge-visible"),
      );
      assert.match(shown.output ?? "", /bridge-visible/);
      // Live paints the mark as disconnected unless a /poll is parked. Waiting
      // out the agent turn drops that, which is the whole generate.
      const during = await infoFor("apps/two");
      let agentPolling = false;
      for (let i = 0; i < 20 && !agentPolling; i += 1) {
        const live = await fetch(
          `http://127.0.0.1:${during.port}/status?token=${encodeURIComponent(during.token)}`,
        );
        agentPolling = (await live.json()).agentPolling === true;
        if (!agentPolling) await wait(100);
      }
      assert.equal(agentPolling, true);
      assert.equal(
        (await fetch(`${base}/api/disconnect`, { method: "POST" })).status,
        200,
      );
      const disconnected = await until((s) => s.phase === "idle");
      assert.equal(disconnected.phase, "idle");
      assert.equal(disconnected.error, null);
    } finally {
      if (second) await stop(second.child);
      if (first) await stop(first.child);
      for (const child of lives.values()) await stop(child);
      rmSync(root, { recursive: true, force: true });
    }
  },
);

test("status reports tmux and ttyd when neither is installed", async () => {
  const bin = mkdtempSync(join(tmpdir(), "live-bridge-path-"));
  const { child, listening } = startBridge(join(scripts, "live-bridge.mjs"), {
    PATH: bin,
  });
  try {
    const base = await listening;
    const status = await (await fetch(`${base}/api/status`)).json();
    assert.deepEqual(status.tools, { tmux: false, ttyd: false });
  } finally {
    await stop(child);
    rmSync(bin, { recursive: true, force: true });
  }
});

test("bridge exits when its script changes so the next process can load it", async () => {
  const dir = mkdtempSync(join(tmpdir(), "live-bridge-reload-"));
  const script = join(dir, "scripts/live-bridge.mjs");
  mkdirSync(dirname(script), { recursive: true });
  copyFileSync(join(scripts, "live-bridge.mjs"), script);
  const { child, listening } = startBridge(script, {
    IMPECCABLE_BRIDGE_RELOAD: "1",
  });
  try {
    await listening;
    writeFileSync(script, `${readFileSync(script, "utf8")}\n`);
    const [code] = await Promise.race([
      once(child, "exit"),
      wait(3000).then(() => {
        throw new Error("Bridge kept running after its script changed");
      }),
    ]);
    assert.equal(code, 0);
  } finally {
    await stop(child);
    rmSync(dir, { recursive: true, force: true });
  }
});

const ttyd = spawnSync("which", ["ttyd"], { encoding: "utf8" }).stdout.trim();
const tmuxBin = spawnSync("which", ["tmux"], {
  encoding: "utf8",
}).stdout.trim();

test(
  "a dropped file is written and pasted into the agent session",
  {
    skip: (!ttyd || !tmuxBin) && "ttyd or tmux missing",
    timeout: 20_000,
  },
  async () => {
    const bin = mkdtempSync(join(tmpdir(), "live-bridge-drop-"));
    writeFileSync(
      join(bin, "claude"),
      `#!${process.execPath}\nprocess.stdout.write("ready\\n");\nsetInterval(() => {}, 1 << 30);\n`,
    );
    chmodSync(join(bin, "claude"), 0o755);
    const { child, listening } = startBridge(join(scripts, "live-bridge.mjs"), {
      PATH: `${bin}:${process.env.PATH}`,
      IMPECCABLE_BRIDGE_TTYD: "1",
    });
    try {
      const base = await listening;
      assert.equal(
        (
          await fetch(`${base}/api/connect`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ app: "apps/admin", agent: "claude" }),
          })
        ).status,
        200,
      );
      const body = JSON.stringify({
        files: [
          {
            name: "photo.png",
            data: Buffer.from("png-bytes").toString("base64"),
          },
        ],
      });
      let dropped;
      for (let i = 0; i < 40 && !dropped; i += 1) {
        const response = await fetch(`${base}/api/drop`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        if (response.status === 200) dropped = await response.json();
        else await wait(100);
      }
      assert.ok(dropped?.paths?.[0], "drop was not accepted");
      assert.equal(readFileSync(dropped.paths[0], "utf8"), "png-bytes");
      const status = await (await fetch(`${base}/api/status`)).json();
      assert.match(
        status.state.history.map((item) => item.message).join("\n"),
        /Dropped photo\.png/,
      );
    } finally {
      await stop(child);
      rmSync(bin, { recursive: true, force: true });
    }
  },
);

test(
  "bridge shows the agent in a ttyd terminal while the turn is running",
  {
    skip: (!ttyd || !existsSync(skill)) && "ttyd or impeccable skill missing",
    timeout: 20_000,
  },
  async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), "live-bridge-ttyd-")));
    const bin = join(root, "bin");
    const app = join(root, "apps/demo");
    mkdirSync(join(root, "scripts"));
    mkdirSync(join(root, ".agents/skills"), { recursive: true });
    mkdirSync(bin);
    mkdirSync(join(app, ".impeccable/live"), { recursive: true });
    copyFileSync(
      join(scripts, "live-bridge.mjs"),
      join(root, "scripts/live-bridge.mjs"),
    );
    copyFileSync(
      join(scripts, "live-exec.py"),
      join(root, "scripts/live-exec.py"),
    );
    symlinkSync(skill, join(root, ".agents/skills/impeccable"));
    writeFileSync(
      join(app, "package.json"),
      JSON.stringify({ scripts: { dev: "node ../../scripts/with-live.mjs" } }),
    );
    writeFileSync(
      join(app, ".impeccable/live/roots.json"),
      JSON.stringify({
        version: 1,
        appRoot: app,
        repoRoot: root,
        contextRoot: null,
        sessionRoot: join(app, ".impeccable/live"),
        productPath: null,
        designPath: null,
        resolvedFrom: "test",
      }),
    );
    writeFileSync(
      join(bin, "claude"),
      `#!${process.execPath}
process.stdout.write("ready\\n");
if (process.argv.some((arg) => arg.includes("Tighten") || arg.includes("Live event"))) {
  process.stdout.write("bridge-visible\\n→ Add a follow-up\\n");
}
setInterval(() => {}, 1 << 30);
`,
    );
    chmodSync(join(bin, "claude"), 0o755);
    const live = spawn(
      process.execPath,
      [join(skill, "scripts/live-server.mjs")],
      { cwd: app, stdio: "ignore" },
    );
    const { child, listening } = startBridge(
      join(root, "scripts/live-bridge.mjs"),
      {
        PATH: `${bin}:${process.env.PATH}`,
        IMPECCABLE_BRIDGE_TTYD: "1",
        IMPECCABLE_BRIDGE_IDLE_MS: "800",
      },
    );
    try {
      const base = await listening;
      let info;
      for (let i = 0; i < 50 && !info; i += 1) {
        try {
          info = JSON.parse(
            readFileSync(join(app, ".impeccable/live/server.json"), "utf8"),
          );
        } catch {
          await wait(100);
        }
      }
      assert.ok(info, "Live server did not start");
      assert.equal(
        (
          await fetch(`${base}/api/connect`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ app: "apps/demo", agent: "claude" }),
          })
        ).status,
        200,
      );
      let terminal;
      for (let i = 0; i < 50 && !terminal; i += 1) {
        const status = await (await fetch(`${base}/api/status`)).json();
        terminal = status.state.terminal;
        if (!terminal) await wait(100);
      }
      assert.ok(terminal, "ttyd did not start");
      assert.equal((await fetch(terminal)).status, 200);
      assert.equal(
        (
          await fetch(`http://127.0.0.1:${info.port}/events`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "steer",
              id: "a1b2c3d4",
              message: "Tighten it",
              token: info.token,
            }),
          })
        ).status,
        200,
      );
      let output = "";
      for (let i = 0; i < 50 && !output.includes("bridge-visible"); i += 1) {
        output =
          (await (await fetch(`${base}/api/status`)).json()).state.output ?? "";
        if (!output.includes("bridge-visible")) await wait(100);
      }
      assert.match(output, /bridge-visible/);
      let stillPending = true;
      for (let i = 0; i < 40 && stillPending; i += 1) {
        const live = await fetch(
          `http://127.0.0.1:${info.port}/status?token=${encodeURIComponent(info.token)}`,
        );
        const body = await live.json();
        stillPending = (body.pendingEvents ?? []).some(
          (event) => event.id === "a1b2c3d4",
        );
        if (stillPending) await wait(100);
      }
      assert.equal(stillPending, false);
    } finally {
      await stop(child);
      await stop(live);
      rmSync(root, { recursive: true, force: true });
    }
  },
);
