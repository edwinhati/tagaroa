#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  watch as watchFile,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const self = fileURLToPath(import.meta.url);
const root = resolve(dirname(self), "..");
const scripts = join(root, ".agents/skills/impeccable/scripts");
const pollScript = join(scripts, "live-poll.mjs");
const port = Number(process.env.IMPECCABLE_BRIDGE_PORT || 8410);
// A connection is one agent session: every Live event continues it, and the
// panel's resume command opens the same conversation in a terminal.
const agents = {
  cursor: {
    label: "Cursor",
    open: async (cwd) => {
      const created = await command(["agent", "create-chat"], cwd);
      const id = created.stdout.trim();
      if (created.code !== 0 || !/^[\w-]+$/.test(id))
        throw new Error(
          created.stderr.trim() || "Cursor did not create a chat",
        );
      return id;
    },
    turn: (session, prompt) => [
      "agent",
      "--print",
      "--auto-review",
      "--resume",
      session,
      prompt,
    ],
    // The pane runs this, the same way a terminal would. --print is only the
    // fallback when ttyd is off.
    shell: (session) =>
      session ? ["agent", "--resume", session, "--trust"] : null,
    resume: (session) => `agent --resume ${session}`,
  },
  claude: {
    label: "Claude Code",
    open: async () => randomUUID(),
    turn: (session, prompt, first) => [
      "claude",
      "--print",
      "--permission-mode",
      "auto",
      first ? "--session-id" : "--resume",
      session,
      prompt,
    ],
    shell: (session, turns) => [
      "claude",
      session && (turns ?? 0) > 0 ? "--resume" : "--session-id",
      session,
      "--permission-mode",
      "auto",
    ],
    resume: (session) => `claude --resume ${session}`,
  },
  codex: {
    label: "Codex",
    // Codex names the thread itself, in the first --json event of the first turn.
    open: async () => null,
    sessionFrom: (head) => head.match(/"thread_id":"([\w-]+)"/)?.[1] ?? null,
    turn: (session, prompt) =>
      session
        ? [
            "codex",
            "exec",
            "--approve-for-me",
            "--json",
            "resume",
            session,
            prompt,
          ]
        : ["codex", "exec", "--approve-for-me", "--json", prompt],
    shell: (session) =>
      session
        ? ["codex", "--approve-for-me", "resume", session]
        : ["codex", "--approve-for-me"],
    resume: (session) => `codex resume ${session}`,
  },
  pi: {
    label: "Pi",
    open: async () => randomUUID(),
    turn: (session, prompt) => [
      "pi",
      "--print",
      "--session-id",
      session,
      prompt,
    ],
    shell: (session) =>
      session
        ? ["pi", "--session-id", session, "--approve"]
        : ["pi", "--approve"],
    resume: (session) => `pi --session-id ${session}`,
  },
};

function availableApps() {
  return ["apps", "domains"].flatMap((group) => {
    const directory = join(root, group);
    if (!existsSync(directory)) return [];
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      if (!entry.isDirectory()) return [];
      const name = `${group}/${entry.name}`;
      try {
        const pkg = JSON.parse(
          readFileSync(join(root, name, "package.json"), "utf8"),
        );
        return pkg.scripts?.dev?.includes("with-live.mjs") ? [name] : [];
      } catch {
        return [];
      }
    });
  });
}

const sessionFile = join(root, ".impeccable/bridge.json");
const noLive = "No Live helper is running. Restart bun dev.";

const state = {
  app: null,
  agent: null,
  session: null,
  // Apps whose Live helper this connection is polling. turbo run dev starts
  // one helper per app; a connection that watches only the app named at
  // Connect leaves every other page saying the agent is disconnected.
  listening: [],
  output: "",
  terminal: null,
  phase: "idle",
  event: null,
  error: null,
  history: [],
};
let worker = null;

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function pidAlive(pid) {
  if (!Number.isInteger(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code !== "ESRCH";
  }
}

function liveUp(app) {
  try {
    const info = JSON.parse(
      readFileSync(join(root, app, ".impeccable/live/server.json"), "utf8"),
    );
    return pidAlive(info.pid);
  } catch {
    return false;
  }
}

function readSavedSession() {
  try {
    return JSON.parse(readFileSync(sessionFile, "utf8"));
  } catch {
    return null;
  }
}

function writeSession(connection) {
  mkdirSync(dirname(sessionFile), { recursive: true });
  writeFileSync(
    sessionFile,
    JSON.stringify({
      pid: process.pid,
      app: connection.app,
      agent: connection.agent,
      session: connection.session,
      turns: connection.turns ?? 0,
      opened: connection.opened === true,
    }),
  );
}

function clearSession() {
  try {
    unlinkSync(sessionFile);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function record(message) {
  state.history.unshift({ time: new Date().toLocaleTimeString(), message });
  state.history.length = Math.min(state.history.length, 30);
}

function appendOutput(text) {
  const clean = String(text).replace(
    new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[ -/]*[@-~]`, "g"),
    "",
  );
  if (!clean) return;
  state.output = (state.output + clean).slice(-32_000);
}

let terminal = null;
let terminalReady = Promise.resolve(false);

function findBin(name) {
  const found = spawnSync("which", [name], { encoding: "utf8" });
  const bin = found.stdout?.trim();
  return bin && existsSync(bin) ? bin : null;
}

function stopTerminal() {
  const current = terminal;
  terminal = null;
  state.terminal = null;
  if (current?.name) {
    spawn("tmux", ["kill-session", "-t", current.name], { stdio: "ignore" });
  }
  current?.child.kill("SIGTERM");
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function tmuxOk(args) {
  const bin = findBin("tmux");
  if (!bin || !terminal) return { status: 1, stdout: "", stderr: "" };
  const result = spawnSync(bin, args, { encoding: "utf8" });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function paneState() {
  const result = tmuxOk([
    "display-message",
    "-p",
    "-t",
    terminal.name,
    "#{pane_dead} #{pane_current_command}",
  ]);
  const [dead, command] = result.stdout.trim().split(/\s+/, 2);
  return { dead: dead === "1", command: command ?? "" };
}

function capturePane() {
  return tmuxOk(["capture-pane", "-p", "-t", terminal.name, "-S", "-"]).stdout;
}

function pasteIntoTerminal(text) {
  if (!terminal?.interactive) {
    return { ok: false, error: "Connect a session before dropping files." };
  }
  const file = join(tmpdir(), `tagaroa-paste-${process.pid}.txt`);
  writeFileSync(file, text);
  const loaded = tmuxOk(["load-buffer", "-b", "tagaroa-drop", file]);
  try {
    unlinkSync(file);
  } catch {
    // The buffer already has the text.
  }
  if (loaded.status !== 0) {
    return {
      ok: false,
      error: loaded.stderr.trim() || "Could not reach the agent",
    };
  }
  const pasted = tmuxOk([
    "paste-buffer",
    "-p",
    "-d",
    "-t",
    terminal.name,
    "-b",
    "tagaroa-drop",
  ]);
  if (pasted.status !== 0) {
    return {
      ok: false,
      error: pasted.stderr.trim() || "Could not reach the agent",
    };
  }
  return { ok: true };
}

function safeDropName(name) {
  const base = String(name).split(/[/\\]/).pop() || "file";
  const cleaned = base.replace(/[^\w.\- ]+/g, "_").slice(0, 120);
  return cleaned || "file";
}

function writeDroppedFile(name, bytes) {
  const dir = join(tmpdir(), "tagaroa-drops");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${randomUUID()}-${safeDropName(name)}`);
  writeFileSync(file, bytes);
  return file;
}

function startTerminal(label) {
  stopTerminal();
  if (process.env.IMPECCABLE_BRIDGE_TTYD === "0") {
    terminalReady = Promise.resolve(false);
    return;
  }
  const ttyd = findBin("ttyd");
  const tmux = findBin("tmux");
  if (!ttyd || !tmux) {
    terminalReady = Promise.resolve(false);
    return;
  }
  const name = `tagaroa-${process.pid}`;
  // ttyd starts its command only after a browser connects, and each browser
  // would get a different process. tmux owns one session, so the agent keeps
  // running with the panel closed and every viewer attaches to it.
  const created = spawnSync(
    tmux,
    [
      "new-session",
      "-d",
      "-s",
      name,
      `printf '%s\n' ${shellQuote(`Opening ${label}…`)}; exec sleep 86400`,
    ],
    { encoding: "utf8" },
  );
  if (created.status !== 0) {
    terminalReady = Promise.resolve(false);
    return;
  }
  spawnSync(tmux, ["set-option", "-t", name, "status", "off"]);
  const child = spawn(
    ttyd,
    [
      "-p",
      "0",
      "-6",
      "-W",
      "-t",
      "fontSize=13",
      "-t",
      "cursorBlink=true",
      "--",
      tmux,
      "attach",
      "-t",
      name,
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  terminalReady = new Promise((resolve) => {
    let err = "";
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), 5000);
    child.stderr.on("data", (data) => {
      err += data;
      const match = err.match(/Listening on port: (\d+)/);
      if (!match || terminal) return;
      terminal = { child, name, interactive: false };
      state.terminal = `http://localhost:${match[1]}/`;
      finish(true);
    });
    child.on("exit", () => {
      if (terminal?.child === child) stopTerminal();
      finish(false);
    });
  });
}

function launchInPane(argv, cwd) {
  const file = join(tmpdir(), `tagaroa-argv-${process.pid}.json`);
  writeFileSync(file, JSON.stringify(argv));
  return tmuxOk([
    "respawn-pane",
    "-k",
    "-c",
    cwd,
    "-e",
    `PATH=${process.env.PATH ?? ""}`,
    "-t",
    terminal.name,
    `exec python3 ${shellQuote(join(root, "scripts/live-exec.py"))} ${shellQuote(file)}`,
  ]);
}

async function showAgent(connection) {
  if (!(await terminalReady) || !terminal || connection.stop) return;
  const argv = agents[connection.agent].shell?.(
    connection.session,
    connection.turns ?? 0,
  );
  if (!argv?.[0]) return;
  const cwd = join(root, connection.app);
  argv[0] = findBin(argv[0]) ?? argv[0];
  const started = launchInPane(argv, cwd);
  if (started.status !== 0) {
    record(started.stderr.trim() || "Could not open the agent");
    return;
  }
  for (let i = 0; i < 40 && !connection.stop; i += 1) {
    const pane = paneState();
    if (pane.dead) {
      record(capturePane().trim().slice(-300) || "The agent exited");
      return;
    }
    if (pane.command && pane.command !== "sleep") {
      terminal.interactive = true;
      terminal.startedAt = Date.now();
      return;
    }
    await sleep(50);
  }
}

function rememberCodexSession(connection) {
  if (
    connection.agent !== "codex" ||
    connection.session ||
    !terminal?.startedAt
  )
    return;
  const home = process.env.HOME;
  if (!home) return;
  const rootDir = join(home, ".codex", "sessions");
  if (!existsSync(rootDir)) return;
  const stamp =
    /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i;
  let best = null;
  const visit = (directory) => {
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(path);
        continue;
      }
      const id = entry.name.match(stamp)?.[1];
      if (!id) continue;
      let mtime = 0;
      try {
        mtime = statSync(path).mtimeMs;
      } catch {
        continue;
      }
      if (mtime + 1000 < terminal.startedAt) continue;
      if (!best || mtime > best.mtime) best = { id, mtime };
    }
  };
  visit(rootDir);
  if (!best) return;
  connection.session = best.id;
  if (worker === connection) state.session = best.id;
  writeSession(connection);
}

async function runInteractiveTurn(connection, app, event, prompt) {
  const signal = connection.controller.signal;
  const argv = agents[connection.agent].shell?.(
    connection.session,
    connection.turns ?? 0,
  );
  if (!argv?.[0]) {
    return {
      code: 1,
      head: "",
      stdout: "",
      stderr: "This agent has no interactive session",
    };
  }
  argv[0] = findBin(argv[0]) ?? argv[0];
  argv.push(prompt);
  const started = launchInPane(argv, join(root, app));
  if (started.status !== 0) {
    return {
      code: 1,
      head: "",
      stdout: "",
      stderr: started.stderr.trim() || "Could not start the agent",
    };
  }
  terminal.interactive = true;
  const waiting = event.id ? await pending(app, event.id) : false;
  const idleLimit = Number(process.env.IMPECCABLE_BRIDGE_IDLE_MS || 12_000);
  let idleSince = 0;
  let lastPane = "";
  while (!connection.stop) {
    if (signal.aborted) throw new Error("The operation was aborted");
    rememberCodexSession(connection);
    const text = capturePane().slice(-64_000);
    if (text) state.output = text;
    const pendingEvent = waiting ? await pending(app, event.id) : false;
    if (paneState().dead) {
      return {
        code: pendingEvent ? 1 : 0,
        head: text.slice(0, 4096),
        stdout: text,
        stderr: pendingEvent ? "The agent exited" : "",
      };
    }
    if (!pendingEvent) {
      return { code: 0, head: text.slice(0, 4096), stdout: text, stderr: "" };
    }
    if (text !== lastPane) {
      lastPane = text;
      idleSince = 0;
    } else if (composerIdle(text)) {
      idleSince ||= Date.now();
      if (Date.now() - idleSince >= idleLimit) {
        return {
          code: 1,
          head: text.slice(0, 4096),
          stdout: text,
          stderr: "Agent returned to its prompt without finishing",
        };
      }
    } else {
      idleSince = 0;
    }
    await sleep(400);
  }
  return { code: 1, head: "", stdout: state.output ?? "", stderr: "" };
}

async function command(parts, cwd, signal, mirror = false) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(parts[0], parts.slice(1), {
      cwd,
      signal,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let head = "";
    let stdout = "";
    let stderr = "";
    const take = (data) => {
      const text = data.toString();
      if (mirror) appendOutput(text);
      return text;
    };
    child.stdout.on("data", (data) => {
      const text = take(data);
      if (head.length < 4096) head += text;
      stdout = (stdout + text).slice(-64_000);
    });
    child.stderr.on("data", (data) => {
      stderr = (stderr + take(data)).slice(-16_000);
    });
    child.on("error", reject);
    child.on("close", (code) => resolvePromise({ code, head, stdout, stderr }));
  });
}

async function pending(app, id) {
  const result = await command(
    [process.execPath, join(scripts, "live-status.mjs")],
    join(root, app),
  );
  if (result.code !== 0) return true;
  try {
    return (
      JSON.parse(result.stdout).liveServer?.pendingEvents?.some(
        (event) => event.id === id,
      ) ?? true
    );
  } catch {
    return true;
  }
}

// An agent CLI that cannot reach its own service (a DNS or Wi-Fi blip) failed
// before doing the work, so the same turn is safe to run again.
const unreachable =
  /ENOTFOUND|EAI_AGAIN|ECONNRESET|ECONNREFUSED|ETIMEDOUT|\[unavailable\]/;

// The Cursor composer sits on this line when it is waiting for a new message.
// While a turn is running the same line is marked "ctrl+c to stop" or the
// pane says Working. A stable idle prompt with the action still open means
// the turn ended without the reply that clears Generating.
function composerIdle(text) {
  const tail = String(text)
    .split("\n")
    .filter((line) => line.trim())
    .slice(-12)
    .join("\n");
  if (/ctrl\+c to stop|\bWorking\b|\[Pasted text/.test(tail)) return false;
  return /→\s*Add a follow-up/.test(tail);
}

const needsReply = new Set([
  "generate",
  "steer",
  "manual_edit_apply",
  "carbonize_cleanup",
  "variant_mount_failed",
]);

function ignored(event) {
  return (
    event.type === "prefetch" ||
    (event.type === "discard" && event._completionAck?.ok === true) ||
    (event.type === "accept" &&
      event._completionAck?.ok === true &&
      event._acceptResult?.handled === true &&
      event._acceptResult?.carbonize !== true)
  );
}

function enqueue(connection, task) {
  const run = (connection.tail ?? Promise.resolve()).then(async () => {
    if (!connection.stop) await task();
  });
  connection.tail = run.then(
    () => {},
    () => {},
  );
  return run;
}

async function runEvent(connection, app, event) {
  if (connection.stop || worker !== connection) return;
  const cwd = join(root, app);
  const agent = agents[connection.agent];
  state.phase = "working";
  state.event = { id: event.id ?? null, type: event.type };
  state.error = null;
  record(`Received ${event.type}${event.id ? ` ${event.id}` : ""} from ${app}`);
  appendOutput(
    `${state.output ? "\n" : ""}— ${event.type}${event.id ? ` ${event.id}` : ""}\n`,
  );

  const prompt = `You are handling one Impeccable Live event in ${cwd}. Read ${join(root, ".agents/skills/impeccable/reference/live.md")} for the action contract. Handle the event below. Its _instructions tell you exactly how to reply. Do not start another poll or stop the Live server; this bridge handles polling. Do not ask the user to repeat the action.\n\n${JSON.stringify(event)}`;
  let result;
  for (let attempt = 1; ; attempt += 1) {
    if (connection.stop) return;
    try {
      result = terminal?.interactive
        ? await runInteractiveTurn(connection, app, event, prompt)
        : await command(
            agent.turn(connection.session, prompt, !connection.turns),
            cwd,
            connection.controller.signal,
            true,
          );
    } catch (error) {
      if (connection.stop) return;
      result = { code: 1, head: "", stderr: error.message, stdout: "" };
    }
    if (!connection.session && agent.sessionFrom) {
      connection.session = agent.sessionFrom(result.head);
      if (worker === connection) state.session = connection.session;
      writeSession(connection);
    }
    const offline =
      result.code !== 0 && unreachable.test(`${result.stderr}${result.stdout}`);
    // A turn that never reached the agent's service made no session; one that
    // failed later mid-turn and then flips claude to --resume is fine.
    if (!offline) {
      connection.turns = (connection.turns ?? 0) + 1;
      writeSession(connection);
    }
    if (!offline || connection.stop || attempt === 3) break;
    record(`${agent.label} couldn't reach its service · retry ${attempt}`);
    await sleep(attempt * 3000);
  }
  if (connection.stop || worker !== connection) return;

  if (needsReply.has(event.type) && (await pending(app, event.id))) {
    const reason = (
      result.stderr ||
      result.stdout ||
      "Agent finished without replying"
    )
      .trim()
      .slice(-250);
    const reply = await command(
      [process.execPath, pollScript, "--reply", event.id, "error", reason],
      cwd,
    );
    if (connection.stop || worker !== connection) return;
    if (reply.code !== 0)
      state.error = `Could not reply to ${event.id}: ${reply.stderr.trim()}`;
    else state.error = `${agent.label} didn't finish ${event.type}: ${reason}`;
    record(state.error);
  } else if (result.code !== 0) {
    state.error = (
      result.stderr ||
      result.stdout ||
      `Agent exited ${result.code}`
    )
      .trim()
      .slice(-500);
    record(state.error);
  } else {
    state.error = null;
    record(`Finished ${event.type}${event.id ? ` ${event.id}` : ""}`);
  }
  if (worker === connection && !connection.stop) {
    state.phase = "waiting";
    state.event = null;
  }
}

async function pollApp(connection, app) {
  const cwd = join(root, app);
  while (!connection.stop && liveUp(app)) {
    let polled;
    try {
      polled = await command(
        [process.execPath, pollScript],
        cwd,
        connection.controller.signal,
      );
    } catch {
      if (connection.stop) return;
      await sleep(2000);
      continue;
    }
    if (connection.stop) return;
    if (polled.code !== 0) {
      await sleep(2000);
      continue;
    }
    let event;
    try {
      event = JSON.parse(polled.stdout.trim());
    } catch {
      await sleep(2000);
      continue;
    }
    if (event.type === "timeout") continue;
    // Live sends `exit` once this app's last tab has been gone 8s — a move to
    // another microfrontend, a slow reload — and when its helper shuts down.
    // Neither ends the connection: the other apps stay polled.
    if (event.type === "exit") {
      record(`No Live tab open in ${app}`);
      continue;
    }
    if (ignored(event)) {
      record(`Finished ${event.type}`);
      continue;
    }
    // One action at a time. A second Live event waits here instead of being
    // typed into the agent while it is still on the previous one.
    if (connection.tail) {
      record(
        `Queued ${event.type}${event.id ? ` ${event.id}` : ""} until the current action finishes`,
      );
    }
    // Live marks the agent disconnected unless a /poll is parked. Waiting out
    // the turn here left that dark for the whole generate. The event stays
    // leased, so the next poll only waits for whatever comes after it.
    enqueue(connection, () => runEvent(connection, app, event)).catch(
      (error) => {
        if (connection.stop || worker !== connection) return;
        state.error = error.message;
        record(error.message);
      },
    );
  }
}

async function watch(connection) {
  const tasks = new Map();
  let quietSince = 0;
  while (!connection.stop) {
    for (const app of availableApps()) {
      if (tasks.has(app) || !liveUp(app)) continue;
      tasks.set(
        app,
        pollApp(connection, app).finally(() => {
          tasks.delete(app);
          if (worker === connection) state.listening = [...tasks.keys()];
        }),
      );
    }
    if (worker === connection) {
      state.listening = [...tasks.keys()];
      if (tasks.size === 0) {
        quietSince ||= Date.now();
        if (
          Date.now() - quietSince > 2000 &&
          state.phase !== "working" &&
          state.phase !== "stopping"
        ) {
          state.phase = "error";
          state.error = noLive;
        }
      } else if (state.error === noLive) {
        quietSince = 0;
        if (state.phase !== "working") {
          state.phase = "waiting";
          state.error = null;
        }
      } else {
        quietSince = 0;
      }
    }
    await sleep(400);
  }
  await Promise.allSettled(tasks.values());
}

async function serve(connection) {
  const agent = agents[connection.agent];
  try {
    if (!connection.opened) {
      connection.session = await agent.open(join(root, connection.app));
      connection.opened = true;
      if (worker === connection) state.session = connection.session;
    }
    if (connection.stop) return;
    writeSession(connection);
    await showAgent(connection);
    if (connection.stop) return;
    await watch(connection);
  } finally {
    finish(connection);
  }
}

function finish(connection) {
  if (worker !== connection) return;
  stopTerminal();
  worker = null;
  state.phase = "idle";
  state.event = null;
  state.listening = [];
  state.app = null;
  state.agent = null;
  state.session = null;
  if (connection.stop) state.error = null;
}

function startWorker({
  app,
  agent,
  session = null,
  turns = 0,
  opened = false,
}) {
  if (worker) return false;
  const connection = {
    app,
    agent,
    stop: false,
    controller: new AbortController(),
    session: opened ? session : null,
    opened,
    turns,
  };
  worker = connection;
  state.app = app;
  state.agent = agent;
  state.session = connection.session;
  state.error = null;
  state.phase = "waiting";
  state.event = null;
  state.listening = [];
  state.output = "";
  startTerminal(agents[agent].label);
  record(
    opened
      ? `Reconnected ${agents[agent].label}`
      : `Connected ${agents[agent].label} to ${app}`,
  );
  serve(connection).catch((error) => {
    if (!connection.stop) {
      state.error = error.message;
      record(error.message);
    }
    finish(connection);
  });
  return true;
}

function resumeSavedSession() {
  if (process.env.IMPECCABLE_BRIDGE_RESUME === "0") return;
  const saved = readSavedSession();
  if (!saved || pidAlive(saved.pid)) return;
  if (
    !Object.hasOwn(agents, saved.agent) ||
    !availableApps().includes(saved.app)
  ) {
    clearSession();
    return;
  }
  startWorker({
    app: saved.app,
    agent: saved.agent,
    session: saved.session ?? null,
    turns: saved.turns ?? 0,
    opened: saved.opened === true,
  });
}

function resumeCommand() {
  if (!state.session) return null;
  const directory = join(root, state.app).replaceAll("'", "'\\''");
  return `cd '${directory}' && ${agents[state.agent].resume(state.session)}`;
}

function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

const page = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Impeccable Bridge</title><style>
:root{font:15px system-ui;color:#ede9df;background:#151719}body{max-width:720px;margin:8vh auto;padding:0 24px}h1{font-size:26px;margin-bottom:6px}p{color:#a8aaa7}section{background:#202326;border:1px solid #383c3e;border-radius:12px;padding:20px;margin-top:24px}label{display:block;margin:16px 0 6px}select,button{font:inherit;padding:10px 12px;border-radius:7px;border:1px solid #555b5c;background:#303537;color:inherit}select{width:100%}button{cursor:pointer;margin-top:20px;background:#c8f16b;color:#1b240b;border:0;font-weight:650}button:disabled{opacity:.5;cursor:default}button.secondary{background:#454b4c;color:#fff;margin-left:8px}.status{font-size:18px;font-weight:650}.error{color:#ffad98;white-space:pre-wrap;overflow-wrap:anywhere}ul{padding-left:20px;color:#bdc0bb}li{margin:7px 0}small{color:#969b98}
</style><main><h1>Impeccable Bridge</h1><p>Route widget actions to one local coding agent while <code>bun dev</code> runs.</p><section><div class="status" id="status">Loading…</div><div id="error" class="error"></div><label for="app">App</label><select id="app"></select><label for="agent">Agent</label><select id="agent"><option value="cursor">Cursor</option><option value="claude">Claude Code</option><option value="codex">Codex</option><option value="pi">Pi</option></select><button id="connect">Connect</button><button class="secondary" id="disconnect">Disconnect</button></section><section><strong>Recent actions</strong><ul id="history"></ul></section></main><script>
const $=id=>document.getElementById(id);let appsLoaded=false;
async function update(){try{const data=await(await fetch('/api/status')).json();if(!appsLoaded){$('app').replaceChildren(...data.apps.map(app=>{const option=document.createElement('option');option.value=app;option.textContent=app;return option}));appsLoaded=true}const s=data.state;const watching=(s.listening||[]).join(', ');$('status').textContent=s.phase==='idle'?'Disconnected':s.phase==='working'?'Working on '+s.event.type:s.phase==='waiting'?(watching?'Listening · '+watching:'Listening for Live'):'Connection error';$('error').textContent=s.error||'';$('connect').disabled=s.phase!=='idle';$('disconnect').disabled=s.phase==='idle';$('app').disabled=s.phase!=='idle';$('agent').disabled=s.phase!=='idle';$('history').replaceChildren(...s.history.map(item=>{const li=document.createElement('li');li.textContent=item.time+' · '+item.message;return li}))}catch{$('status').textContent='Bridge unavailable'}}
$('connect').onclick=async()=>{await fetch('/api/connect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app:$('app').value,agent:$('agent').value})});update()};$('disconnect').onclick=async()=>{await fetch('/api/disconnect',{method:'POST'});update()};update();setInterval(update,1000);
</script></html>`;

const server = createServer(async (request, response) => {
  const origin = request.headers.origin;
  if (origin) {
    let allowed = false;
    try {
      const url = new URL(origin);
      allowed =
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    } catch {
      // Reject malformed origins below.
    }
    if (!allowed) {
      json(response, 403, { error: "Wrong origin" });
      return;
    }
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    response.end();
    return;
  }
  if (request.method === "GET" && request.url === "/") {
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(page);
    return;
  }
  if (request.method === "GET" && request.url === "/api/status") {
    json(response, 200, {
      apps: availableApps(),
      repoRoot: root,
      tools: {
        tmux: Boolean(findBin("tmux")),
        ttyd: Boolean(findBin("ttyd")),
      },
      state: { ...state, resumeCommand: resumeCommand() },
    });
    return;
  }
  if (request.method === "POST" && request.url === "/api/connect") {
    let input;
    try {
      let body = "";
      for await (const chunk of request) {
        body += chunk;
        if (body.length > 4096) throw new Error("Request too large");
      }
      input = JSON.parse(body);
    } catch {
      json(response, 400, { error: "Invalid request" });
      return;
    }
    if (worker) {
      json(response, 409, {
        error: `Already connected to ${state.app}. Disconnect first.`,
      });
      return;
    }
    if (
      typeof input !== "object" ||
      input === null ||
      !availableApps().includes(input.app) ||
      !Object.hasOwn(agents, input.agent)
    ) {
      json(response, 400, { error: "Pick an app and an agent from the list." });
      return;
    }
    startWorker({ app: input.app, agent: input.agent });
    json(response, 200, { ok: true });
    return;
  }
  if (request.method === "POST" && request.url === "/api/disconnect") {
    if (worker) {
      clearSession();
      worker.stop = true;
      worker.controller.abort();
      state.phase = "stopping";
      state.error = null;
    }
    json(response, 200, { ok: true });
    return;
  }
  if (request.method === "POST" && request.url === "/api/drop") {
    let input;
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of request) {
        chunks.push(chunk);
        size += chunk.length;
        if (size > 32_000_000) throw new Error("Request too large");
      }
      input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      json(response, 400, { error: "Invalid request" });
      return;
    }
    const files = Array.isArray(input?.files) ? input.files : [];
    if (
      files.length === 0 ||
      files.some(
        (file) =>
          !file ||
          typeof file.name !== "string" ||
          typeof file.data !== "string",
      )
    ) {
      json(response, 400, { error: "Drop a file." });
      return;
    }
    const paths = files.map((file) =>
      writeDroppedFile(file.name, Buffer.from(file.data, "base64")),
    );
    const pasted = pasteIntoTerminal(
      paths.map((file) => `'${file.replaceAll("'", "'\\''")}'`).join(" "),
    );
    if (!pasted.ok) {
      json(response, 409, { error: pasted.error });
      return;
    }
    record(`Dropped ${files.map((file) => file.name).join(", ")}`);
    json(response, 200, { paths });
    return;
  }
  json(response, 404, { error: "Not found" });
});

// The dev wrapper does not reload this file. Exit when it changes so the
// wrapper can start a process that actually contains the new code. A standby
// bridge from another app does the same, and one of them takes the port.
function restartWhenReplaced(file) {
  if (process.env.IMPECCABLE_BRIDGE_RELOAD === "0") return;
  let since;
  try {
    since = statSync(file).mtimeMs;
  } catch {
    return;
  }
  let pending = false;
  const watcher = watchFile(file, () => {
    if (pending) return;
    pending = true;
    setTimeout(() => {
      let mtime = 0;
      try {
        mtime = statSync(file).mtimeMs;
      } catch {
        pending = false;
        return;
      }
      if (mtime <= since) {
        pending = false;
        return;
      }
      watcher.close();
      console.log("Impeccable Bridge: script changed, restarting");
      stopTerminal();
      process.exit(0);
    }, 150);
  });
}
restartWhenReplaced(self);

// localhost is ::1 first and 127.0.0.1 second. Binding only the v4 address
// makes a browser refresh, which tries ::1 and does not fall back, report the
// bridge as gone while this process is still connected.
let v4Only = false;
server.on("listening", () => {
  console.log(
    `Impeccable Bridge DevTools: http://localhost:${server.address().port}`,
  );
  resumeSavedSession();
});
function listen() {
  if (v4Only) {
    server.listen(port, "127.0.0.1");
    return;
  }
  server.listen({ port, host: "::", ipv6Only: false });
}
server.on("error", (error) => {
  // Every app's wrapper starts a bridge and one wins the port. The rest stand
  // by, so the bridge survives the winning app's dev server stopping.
  if (error.code === "EADDRINUSE") {
    setTimeout(listen, 2000);
    return;
  }
  if (!v4Only && (error.code === "EAFNOSUPPORT" || error.code === "EINVAL")) {
    v4Only = true;
    listen();
    return;
  }
  console.error(`Impeccable Bridge: ${error.message}`);
  process.exitCode = 1;
});
listen();

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    if (worker) {
      worker.stop = true;
      worker.controller.abort();
    }
    stopTerminal();
    process.exit(0);
  });
}
