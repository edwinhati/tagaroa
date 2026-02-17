import { ClassSerializerInterceptor, ValidationPipe } from "@nestjs/common";
import { NestFactory, Reflector } from "@nestjs/core";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { validateEnv } from "./shared/config/env";

const DEFAULT_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:3004",
];

async function bootstrap() {
  validateEnv();

  const app = await NestFactory.create(AppModule);

  // Set global API prefix
  app.setGlobalPrefix("api");

  app.use(helmet());

  const origins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
        .map((o) => o.trim())
        .filter(Boolean)
    : DEFAULT_ORIGINS;

  app.enableCors({
    origin: origins,
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

  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 8080);
}
bootstrap();
