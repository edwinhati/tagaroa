import { spawnSync } from "node:child_process";

const args = process.argv.slice(2).filter((arg) => arg !== "--");
if (!args.some((arg) => arg.startsWith("--project"))) {
  args.push(
    "--project=chromium",
    "--project=webkit",
    "--project=mobile-chromium",
  );
}
// Both apps mutate the same seeded operator and must run sequentially.
for (const app of ["auth", "admin"]) {
  const result = spawnSync("bun", ["run", "test:e2e", ...args], {
    cwd: new URL(`../apps/${app}/`, import.meta.url),
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
