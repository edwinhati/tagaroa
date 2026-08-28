import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_INTERCEPTOR } from "@nestjs/core";

import { AppController } from "./app.controller";
import { AuthModule } from "./modules/auth/auth.module";
import { TemporaryPasswordInterceptor } from "./modules/auth/temporary-password.interceptor";
import * as databaseSchema from "./schema.registry";
import { validateEnv } from "./shared/config/env";
import { DatabaseModule } from "./shared/database/database.module";

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    DatabaseModule.register(databaseSchema),
    AuthModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: TemporaryPasswordInterceptor },
  ],
})
export class AppModule {}
