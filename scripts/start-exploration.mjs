import { spawn } from "node:child_process";
import { createServer } from "node:net";

const ports = [18080, 13001, 13002, 13003];
for (const port of ports) {
  await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(port, () => probe.close(resolve));
  });
}
const children = [];
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      /* Already exited. */
    }
  }
  setTimeout(() => {
    for (const child of children) {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        /* Already exited. */
      }
    }
    process.exit(code);
  }, 2000);
}
process.on("SIGINT", () => stop(130));
process.on("SIGTERM", () => stop(0));
const origins = ports.slice(1).map((port) => `http://localhost:${port}`);
const env = {
  ...process.env,
  E2E_CORE_PORT: "18080",
  E2E_TRUSTED_ORIGINS: origins.join(","),
  PASSKEY_ORIGINS: origins.join(","),
  PASSKEY_RP_ID: "localhost",
  VITE_AUTH_BASE_URL: "http://localhost:18080",
  VITE_AUTH_URL: origins[0],
  VITE_WORKSPACE_URL: origins[1],
  VITE_ADMIN_URL: origins[2],
  VITE_POST_SIGNIN_URL: origins[1],
  VITE_TRUSTED_REDIRECT_ORIGINS: origins.slice(1).join(","),
};
for (const [cwd, args] of [
  ["servers/core", ["test/start-exploration.ts"]],
  ...["auth", "workspace", "admin"].map((app, index) => [
    `apps/${app}`,
    ["run", "dev:plain", "--port", String(ports[index + 1]), "--strictPort"],
  ]),
]) {
  const child = spawn("bun", args, {
    cwd: new URL(`../${cwd}/`, import.meta.url),
    env,
    stdio: "inherit",
    detached: true,
  });
  children.push(child);
  child.on("error", (error) => {
    console.error(error);
    stop(1);
  });
  child.on("exit", (code) => {
    if (!stopping) stop(code || 1);
  });
}
