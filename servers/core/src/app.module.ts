import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";

import { AppController } from "./app.controller";
import { AccessControlModule } from "./modules/access-control/access-control.module";
import { AuditModule } from "./modules/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { SessionPolicyInterceptor } from "./modules/auth/session-policy.interceptor";
import { DirectoryModule } from "./modules/directory/directory.module";
import { HrModule } from "./modules/hr/hr.module";
import { NotificationModule } from "./modules/notification/notification.module";
import { type AppEnv, validateEnv } from "./platform/config/env";
import { DatabaseModule } from "./platform/database/database.module";
import { rateLimitOptions } from "./platform/http/rate-limit";
import { schemaValidation } from "./platform/http/schema-validation";
import * as databaseSchema from "./schema.registry";

@Module({
  controllers: [AppController],
  imports: [
    // `validateEnv` returns every setting the service reads, so `get()` answers
    // from its result alone. Without `skipProcessEnv`, a value it drops — an
    // empty `RESEND_WEBHOOK_SECRET=` it maps to `undefined` — falls back to the
    // raw `""` in `process.env`, and an unset secret reads as a set one.
    ConfigModule.forRoot({
      isGlobal: true,
      skipProcessEnv: true,
      validate: validateEnv,
    }),
    // Core's own routes, per client; Better Auth's routes have their own limit.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnv, true>) =>
        rateLimitOptions({
          nodeEnv: config.get("NODE_ENV", { infer: true }),
          trustedProxies: config.get("AUTH_TRUSTED_PROXIES", { infer: true }),
        }),
    }),
    DatabaseModule.register(databaseSchema),
    AuditModule,
    AuthModule,
    AccessControlModule,
    DirectoryModule,
    HrModule,
    NotificationModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: SessionPolicyInterceptor },
    // Parses every `@Body({ schema })` / `@Query({ schema })`; see the file.
    { provide: APP_PIPE, useValue: schemaValidation },
  ],
})
export class AppModule {}
