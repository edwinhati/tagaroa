import { ClassSerializerInterceptor, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory, Reflector } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { apiReference } from "@scalar/nestjs-api-reference";
import type { Request, Response } from "express";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { FinanceModule } from "./modules/finance/finance.module";
import { StorageModule } from "./modules/storage/storage.module";
import type { AppConfig } from "./shared/config/env.validation";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService<AppConfig, true>);
  const isDevelopment = process.env.NODE_ENV === "development";

  // Set global API prefix
  app.setGlobalPrefix("api");

  app.use(
    helmet({
      contentSecurityPolicy: isDevelopment ? false : undefined,
    }),
  );

  app.use("/favicon.ico", (_req: Request, res: Response) => {
    res.status(204).end();
  });

  const trustedOrigins = configService.get("TRUSTED_ORIGINS", { infer: true });
  app.enableCors({
    origin: trustedOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector), {
      excludeExtraneousValues: true,
    }),
  );

  // OpenAPI / Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle("Tagaroa API")
    .setDescription("Finance management platform API")
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
  }

  SwaggerModule.setup("docs", app, document);

  app.enableShutdownHooks();

  await app.listen(configService.get("PORT", { infer: true }));
}
bootstrap();
