import { ConsoleLogger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";

export async function createApplication() {
  const logger =
    process.env.NODE_ENV === "test"
      ? false
      : process.env.NODE_ENV === "production"
        ? new ConsoleLogger({ json: true, structuredParams: true })
        : undefined;
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    logger,
    return503OnClosing: true,
    routeConflictPolicy: { duplicate: "error", shadow: "warn" },
    routeResolutionStrategy: "specificity",
  });

  app.enableShutdownHooks();
  app.setGlobalPrefix("api");

  return app;
}
