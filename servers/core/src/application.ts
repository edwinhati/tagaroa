import { ConsoleLogger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";
import type { AppEnv } from "./platform/config/env";

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

  // Better Auth answers CORS for its own routes from `trustedOrigins`. Anything
  // this service adds beside it — /api/directory, and whatever follows — is a
  // plain Nest route with no such handling, so the same list is applied here.
  // `credentials` because every one of them is read with the session cookie.
  const config = app.get(ConfigService<AppEnv, true>);
  const trustedOrigins = config.get("TRUSTED_ORIGINS", { infer: true });
  app.enableCors({ credentials: true, origin: trustedOrigins });

  // CORS protects responses, not cookie-authenticated writes: the same list
  // gates cross-origin writes. Better Auth checks its own routes against
  // `trustedOrigins`, and provider webhooks are verified by their signatures.
  app.enableCsrfProtection({
    exclude: ["auth/*path", "notifications/webhooks/*path"],
    trustedOrigins,
  });
  app.useSecurityHeaders();

  return app;
}
