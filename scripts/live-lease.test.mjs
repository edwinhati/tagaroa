import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const scripts = dirname(fileURLToPath(import.meta.url));
const skill = join(scripts, "../.agents/skills/impeccable");
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

test("a dropped poll releases the live command so the next poll can take it", async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "live-lease-")));
  const app = join(root, "apps/demo");
  mkdirSync(join(app, ".impeccable/live"), { recursive: true });
  writeFileSync(join(app, "package.json"), JSON.stringify({ name: "demo" }));
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
  const live = spawn(
    process.execPath,
    [join(skill, "scripts/live-server.mjs")],
    {
      cwd: app,
      env: { ...process.env, IMPECCABLE_PREFLIGHT_DELAY_MS: "1500" },
      stdio: "ignore",
    },
  );
  try {
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
    const base = `http://127.0.0.1:${info.port}`;
    assert.equal(
      (
        await fetch(`${base}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "steer",
            id: "abcd1234",
            message: "Tighten it",
            token: info.token,
          }),
        })
      ).status,
      200,
    );
    const poll = `${base}/poll?token=${encodeURIComponent(info.token)}&timeout=2000&leaseMs=600000`;
    const controller = new AbortController();
    const dropped = fetch(poll, { signal: controller.signal });
    let leased = false;
    for (let i = 0; i < 20 && !leased; i += 1) {
      await wait(50);
      const status = await (
        await fetch(`${base}/status?token=${encodeURIComponent(info.token)}`)
      ).json();
      leased = (status.pendingEvents ?? []).some(
        (event) => event.id === "abcd1234" && event.leased === true,
      );
    }
    assert.equal(leased, true);
    controller.abort();
    await dropped.catch(() => {});
    const delivered = await (await fetch(poll)).json();
    assert.equal(delivered.type, "steer");
    assert.equal(delivered.id, "abcd1234");
  } finally {
    live.kill("SIGTERM");
    rmSync(root, { recursive: true, force: true });
  }
});
