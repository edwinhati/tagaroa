import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { createApplication } from "./application";
import type { AppEnv } from "./shared/config/env";

async function bootstrap() {
  const app = await createApplication();
  const config = app.get(ConfigService<AppEnv, true>);

  await app.listen(config.get("PORT", { infer: true }));
}

void bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  new Logger("Bootstrap").error(message);
  process.exitCode = 1;
});
