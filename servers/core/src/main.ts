import { ClassSerializerInterceptor, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory, Reflector } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";
import type { AppConfig } from "./shared/config/env.validation";

const DEFAULT_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:3004",
];

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService<AppConfig, true>);

  // Set global API prefix
  app.setGlobalPrefix("api");

  app.use(helmet());

  const allowedOrigins = configService.get("ALLOWED_ORIGINS", { infer: true });
  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : DEFAULT_ORIGINS,
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
  SwaggerModule.setup("docs", app, document);

  app.enableShutdownHooks();

  await app.listen(configService.get("PORT", { infer: true }));
}
bootstrap();
