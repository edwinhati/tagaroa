import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { SentryModule } from "@sentry/nestjs/setup";
import { AuthModule } from "./modules/auth/auth.module";
import { FinanceModule } from "./modules/finance/finance.module";
import { HealthModule } from "./modules/health/health.module";
import { InvestmentModule } from "./modules/investment/investment.module";
import { ObservabilityModule } from "./modules/observability/observability.module";
import { StorageModule } from "./modules/storage/storage.module";
import { envSchema } from "./shared/config/env.validation";
import { DebugController } from "./shared/controllers/debug.controller";
import { DatabaseModule } from "./shared/database/database.module";
import { AllExceptionsFilter } from "./shared/filters/all-exceptions.filter";
import { DevelopmentGuard } from "./shared/guards/development.guard";
import { ResponseInterceptor } from "./shared/interceptors/response.interceptor";
import { LoggerMiddleware } from "./shared/middleware/logger.middleware";
import { RequestIdMiddleware } from "./shared/middleware/request-id.middleware";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (env) => envSchema.parse(env),
    }),
    DatabaseModule,
    AuthModule,
    FinanceModule,
    InvestmentModule,
    StorageModule,
    HealthModule,
    SentryModule.forRoot(),
    ObservabilityModule,
  ],
  controllers: [DebugController],
  providers: [
    DevelopmentGuard,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware, LoggerMiddleware).forRoutes("*path");
  }
}
