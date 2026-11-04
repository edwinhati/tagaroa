import { readdirSync } from "node:fs";
import { join } from "node:path";

const directory = join(import.meta.dir, "integration");
const files = readdirSync(directory)
  .filter((file) => file.endsWith(".integration.ts"))
  .sort();

// Bun 1.4.2 can stall SQL setup across --isolate globals in one process.
for (const file of files) {
  console.info(`Integration file: ${file}`);
  const result = Bun.spawnSync(
    [process.execPath, "test", join(directory, file), ...process.argv.slice(2)],
    { stdout: "inherit", stderr: "inherit", timeout: 120_000 },
  );
  if (!result.success) {
    console.error(
      `Integration file failed: ${file} (${result.signalCode ?? result.exitCode})`,
    );
    process.exit(result.exitCode || 1);
  }
}
