import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_INTERCEPTOR } from "@nestjs/core";

import { AppController } from "./app.controller";
import { AccessControlModule } from "./modules/access-control/access-control.module";
import { AuditModule } from "./modules/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { PrivilegedMfaInterceptor } from "./modules/auth/privileged-mfa.interceptor";
import { TemporaryPasswordInterceptor } from "./modules/auth/temporary-password.interceptor";
import { DirectoryModule } from "./modules/directory/directory.module";
import { NotificationModule } from "./modules/notification/notification.module";
import { validateEnv } from "./platform/config/env";
import { DatabaseModule } from "./platform/database/database.module";
import * as databaseSchema from "./schema.registry";

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    DatabaseModule.register(databaseSchema),
    AuditModule,
    AuthModule,
    AccessControlModule,
    DirectoryModule,
    NotificationModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: TemporaryPasswordInterceptor },
    { provide: APP_INTERCEPTOR, useClass: PrivilegedMfaInterceptor },
  ],
})
export class AppModule {}
