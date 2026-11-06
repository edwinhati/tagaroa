import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";

import { AppController } from "./app.controller";
import { AccessControlModule } from "./modules/access-control/access-control.module";
import { AuditModule } from "./modules/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ImpersonationInterceptor } from "./modules/auth/impersonation.interceptor";
import { PrivilegedMfaInterceptor } from "./modules/auth/privileged-mfa.interceptor";
import { TemporaryPasswordInterceptor } from "./modules/auth/temporary-password.interceptor";
import { DirectoryModule } from "./modules/directory/directory.module";
import { HrModule } from "./modules/hr/hr.module";
import { NotificationModule } from "./modules/notification/notification.module";
import { validateEnv } from "./platform/config/env";
import { DatabaseModule } from "./platform/database/database.module";
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
    DatabaseModule.register(databaseSchema),
    AuditModule,
    AuthModule,
    AccessControlModule,
    DirectoryModule,
    HrModule,
    NotificationModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: TemporaryPasswordInterceptor },
    { provide: APP_INTERCEPTOR, useClass: PrivilegedMfaInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ImpersonationInterceptor },
    // Parses every `@Body({ schema })` / `@Query({ schema })`; see the file.
    { provide: APP_PIPE, useValue: schemaValidation },
  ],
})
export class AppModule {}
