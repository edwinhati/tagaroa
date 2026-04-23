import "./instrument";

import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { apiReference } from "@scalar/nestjs-api-reference";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { auth } from "./modules/auth/auth-instance";
import { FinanceModule } from "./modules/finance/finance.module";
import { OpenTelemetryService } from "./modules/observability/infrastructure/opentelemetry.service";
import { StorageModule } from "./modules/storage/storage.module";
import type { AppConfig } from "./shared/config/env.validation";
import { ZodValidationPipe } from "./shared/pipes/zod-validation.pipe";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService<AppConfig, true>);

  const otelService = app.get(OpenTelemetryService);
  await otelService.initialize();

  const isDevelopment = process.env.NODE_ENV === "development";

  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ZodValidationPipe());

  app.use(
    helmet({
      contentSecurityPolicy: isDevelopment ? false : undefined,
    }),
  );

  const trustedOrigins = configService.get("TRUSTED_ORIGINS", { infer: true });
  app.enableCors({
    origin: trustedOrigins,
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Tagaroa API")
    .setVersion("1.0")
    .addCookieAuth("session")
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  if (isDevelopment) {
    const financeDocument = SwaggerModule.createDocument(app, swaggerConfig, {
      include: [FinanceModule],
    });

    const storageDocument = SwaggerModule.createDocument(app, swaggerConfig, {
      include: [StorageModule],
    });

    app.use(
      "/api/finance/reference",
      apiReference({
        content: financeDocument,
      }),
    );

    app.use(
      "/api/storage/reference",
      apiReference({
        content: storageDocument,
      }),
    );

    // Auth Reference (OpenAPI)
    const baseUrl = configService.get("BASE_URL", { infer: true });
    try {
      const authSchemaRes = await auth.handler(
        new Request(`${baseUrl}/api/auth/open-api/generate-schema`),
      );
      if (authSchemaRes.ok) {
        const authSchema = (await authSchemaRes.json()) as Record<
          string,
          unknown
        >;
        app.use(
          "/api/auth/reference",
          apiReference({
            content: authSchema,
          }),
        );
      }
    } catch (error) {
      console.error("Failed to generate Auth OpenAPI schema:", error);
    }
  }

  SwaggerModule.setup("docs", app, document);

  app.enableShutdownHooks();

  await app.listen(configService.get("PORT", { infer: true }));
}

bootstrap();
