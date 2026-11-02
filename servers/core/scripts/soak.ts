import { resolve } from "node:path";
import { parseArgs } from "node:util";

import { authenticatorCode } from "@repo/test-support/totp";

/**
 * Sustained load against the core service on the isolated test database.
 *
 * Boots the service the way the e2e suites do (`test/start-e2e.ts`: migrate,
 * seed the e2e operator, listen) in its own process, so the RSS it reports is
 * the server's alone. Signs the operator in, enrols TOTP so administration
 * opens, then fires a fixed mix of reads and writes at a fixed rate (open
 * loop: a slow reply does not slow the next request) for the given duration.
 *
 *   bun run test:soak -- --rate 50 --duration 600
 *
 * Exits non-zero on any failed request. Not part of `test` or CI.
 */

const { values } = parseArgs({
  options: {
    duration: { type: "string", default: "60" },
    port: { type: "string", default: "8095" },
    rate: { type: "string", default: "20" },
  },
});
const rate = Number(values.rate);
const durationMs = Number(values.duration) * 1000;
const port = values.port;
if (!(rate > 0) || !(durationMs > 0)) {
  throw new Error("--rate and --duration must be positive numbers.");
}

const baseURL = `http://127.0.0.1:${port}`;
const origin = "http://localhost:3001";
// `test/e2e-admin.ts` seeds this account; the values are fixtures.
const operator = {
  email: "e2e-admin@tagaroa.test",
  password: "e2e-admin-password-12",
};

const server = Bun.spawn(["bun", "test/start-e2e.ts"], {
  cwd: resolve(import.meta.dir, ".."),
  env: {
    ...process.env,
    E2E_CORE_PORT: port,
    E2E_TRUSTED_ORIGINS: origin,
  },
  stdout: "ignore",
  stderr: "inherit",
});

const rssMiB = () => {
  const ps = Bun.spawnSync(["ps", "-o", "rss=", "-p", String(server.pid)]);
  return Number(ps.stdout.toString().trim()) / 1024;
};

const jar = new Map<string, string>();
const cookie = () =>
  [...jar].map(([name, value]) => `${name}=${value}`).join("; ");

const request = async (path: string, init: RequestInit = {}) => {
  const response = await fetch(`${baseURL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", origin, cookie: cookie() },
    signal: AbortSignal.timeout(10_000),
  });
  for (const header of response.headers.getSetCookie()) {
    const [pair = ""] = header.split(";", 1);
    const at = pair.indexOf("=");
    jar.set(pair.slice(0, at), pair.slice(at + 1));
  }
  return response;
};

const expectOk = async (response: Response, step: string) => {
  if (!response.ok) {
    throw new Error(`${step}: ${response.status} ${await response.text()}`);
  }
  return response.json();
};

const waitForReady = async () => {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error("The core service exited.");
    try {
      if ((await fetch(`${baseURL}/api/health/ready`)).ok) return;
    } catch {}
    await Bun.sleep(500);
  }
  throw new Error("The core service was not ready within 120 seconds.");
};

const signIn = async (): Promise<string> => {
  const post = (path: string, body: unknown) =>
    request(path, { method: "POST", body: JSON.stringify(body) });
  await expectOk(await post("/api/auth/sign-in/email", operator), "sign-in");
  // The seed leaves the operator without MFA, and a privileged session without
  // it is refused every business route.
  const { totpURI } = await expectOk(
    await post("/api/auth/two-factor/enable", { password: operator.password }),
    "two-factor enable",
  );
  await expectOk(
    await post("/api/auth/two-factor/verify-totp", {
      code: authenticatorCode(totpURI),
    }),
    "two-factor verify",
  );
  const { user } = await expectOk(
    await request("/api/auth/get-session"),
    "get-session",
  );
  return user.id;
};

/** Ten requests in rotation: eight reads the admin app makes, and writes. */
const mixFor = (userId: string) => {
  const page = (n: number) => 1 + (n % 3);
  return [
    (n: number) => [
      "directory",
      `/api/directory?teamsPage=${page(n)}&positionsPage=${page(n)}&subsidiariesPage=${page(n)}`,
    ],
    (n: number) => [
      "directory",
      `/api/directory?teamsLimit=10&teamsPage=${page(n)}`,
    ],
    (n: number) => [
      "notifications",
      `/api/notifications/messages?limit=25&page=${page(n)}`,
    ],
    () => ["notifications", "/api/notifications/messages?limit=100"],
    () => ["audit", "/api/directory/dashboard?eventsLimit=25"],
    (n: number) => [
      "audit",
      `/api/directory/dashboard?eventsLimit=10&eventsPage=${page(n)}`,
    ],
    () => ["session", "/api/auth/get-session"],
    () => ["notifications", "/api/notifications/templates?limit=10"],
    // An upsert, so writes can arrive in any order; each one is audited, which
    // keeps the audit timeline growing the way a working day does.
    (n: number) => [
      "write",
      `/api/directory/positions/group/${userId}`,
      JSON.stringify({ title: `Soak title ${n % 7}` }),
    ],
    (n: number) => [
      "write",
      `/api/directory/positions/group/${userId}`,
      JSON.stringify({ title: `Soak lead ${n % 5}` }),
    ],
  ] as const satisfies ((n: number) => readonly [string, string, string?])[];
};

const percentile = (sorted: number[], p: number) =>
  sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)] ?? 0;

const summary = (durations: number[]) => {
  const sorted = [...durations].sort((a, b) => a - b);
  return {
    p50: percentile(sorted, 0.5).toFixed(1),
    p95: percentile(sorted, 0.95).toFixed(1),
    p99: percentile(sorted, 0.99).toFixed(1),
  };
};

try {
  await waitForReady();
  const userId = await signIn();
  const mix = mixFor(userId);
  const durations = new Map<string, number[]>();
  const failures = new Map<string, number>();
  const rss: number[] = [rssMiB()];
  const inFlight: Promise<void>[] = [];

  const fire = async (n: number) => {
    const [route, path, body] = mix[n % mix.length]!(n);
    const started = performance.now();
    let outcome = "ok";
    try {
      const response = await request(path, body ? { method: "PUT", body } : {});
      await response.arrayBuffer();
      if (!response.ok) outcome = `${route} ${response.status}`;
    } catch (error) {
      outcome = `${route} ${(error as Error).name}`;
    }
    const list = durations.get(route) ?? [];
    list.push(performance.now() - started);
    durations.set(route, list);
    if (outcome !== "ok")
      failures.set(outcome, (failures.get(outcome) ?? 0) + 1);
  };

  const interval = 1000 / rate;
  const started = performance.now();
  let lastSample = started;
  for (let n = 0; performance.now() - started < durationMs; n++) {
    inFlight.push(fire(n));
    const now = performance.now();
    if (now - lastSample >= 5000) {
      rss.push(rssMiB());
      lastSample = now;
    }
    await Bun.sleep(Math.max(0, started + (n + 1) * interval - now));
  }
  await Promise.all(inFlight);
  const elapsed = (performance.now() - started) / 1000;
  rss.push(rssMiB());

  const sessionStillValid = (await request("/api/auth/get-session")).ok;
  const all = [...durations.values()].flat();
  const errors = [...failures.values()].reduce((a, b) => a + b, 0);

  console.info(
    `\nSoak: ${all.length} requests in ${elapsed.toFixed(0)}s at ${rate}/s target (${(all.length / elapsed).toFixed(1)}/s achieved)`,
  );
  console.table(
    Object.fromEntries(
      [["all", all] as const, ...durations].map(([route, list]) => [
        route,
        { requests: list.length, ...summary(list) },
      ]),
    ),
  );
  console.info(
    `errors=${errors}${errors ? ` ${JSON.stringify(Object.fromEntries(failures))}` : ""}`,
  );
  console.info(
    `server RSS MiB: start=${rss[0]!.toFixed(1)} end=${rss.at(-1)!.toFixed(1)} peak=${Math.max(...rss).toFixed(1)} growth=${(rss.at(-1)! - rss[0]!).toFixed(1)}`,
  );
  console.info(`session still valid: ${sessionStillValid}`);
  if (errors > 0 || !sessionStillValid) process.exitCode = 1;
} finally {
  server.kill();
  await server.exited;
}
