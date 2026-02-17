import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { AuthModule } from "./modules/auth/auth.module";
import { FinanceModule } from "./modules/finance/finance.module";
import { StorageModule } from "./modules/storage/storage.module";
import { DatabaseModule } from "./shared/database/database.module";
import { AllExceptionsFilter } from "./shared/filters/all-exceptions.filter";
import { ResponseInterceptor } from "./shared/interceptors/response.interceptor";
import { LoggerMiddleware } from "./shared/middleware/logger.middleware";

@Module({
  imports: [DatabaseModule, AuthModule, FinanceModule, StorageModule],
  providers: [
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
    consumer.apply(LoggerMiddleware).forRoutes("*path");
  }
}
