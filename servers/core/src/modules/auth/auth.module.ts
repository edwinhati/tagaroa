import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthModule as BetterAuthModule } from "@thallesp/nestjs-better-auth";

import type { AppEnv } from "../../shared/config/env";
import { createAuth } from "./auth";
import {
  AUTH_REPOSITORY,
  type AuthRepository,
  AuthPersistenceModule,
} from "./infrastructure/persistence/auth.persistence.module";

@Module({
  imports: [
    BetterAuthModule.forRootAsync({
      inject: [AUTH_REPOSITORY, ConfigService],
      imports: [AuthPersistenceModule, ConfigModule],
      useFactory: (
        repository: AuthRepository,
        config: ConfigService<AppEnv, true>,
      ) => ({
        auth: createAuth(repository, {
          baseURL: config.get("BETTER_AUTH_URL", { infer: true }),
          nodeEnv: config.get("NODE_ENV", { infer: true }),
          secret: config.get("BETTER_AUTH_SECRET", { infer: true }),
          trustedOrigins: config.get("TRUSTED_ORIGINS", { infer: true }),
        }),
      }),
    }),
  ],
})
export class AuthModule {}
