import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthModule as BetterAuthModule } from "@thallesp/nestjs-better-auth";

import type { AppEnv } from "../../platform/config/env";
import {
  AUDIT_TRAIL,
  type AuditTrail,
} from "../audit/application/audit.facade";
import { AuditModule } from "../audit/audit.module";
import { NotificationModule } from "../notification/notification.module";
import {
  ACCOUNT_LIFECYCLE,
  AccountLifecycleFacade,
} from "./account-lifecycle.facade";
import { createAuth } from "./auth";
import { AuthManagementController } from "./auth-management.controller";
import { IdentityOperationsService } from "./identity-operations.service";
import {
  AUTH_REPOSITORY,
  type AuthRepository,
  AuthPersistenceModule,
} from "./infrastructure/persistence/auth.persistence.module";
import { OnboardingHook } from "./onboarding.hook";

@Module({
  controllers: [AuthManagementController],
  imports: [
    AuditModule,
    NotificationModule,
    BetterAuthModule.forRootAsync({
      inject: [AUTH_REPOSITORY, ConfigService, AUDIT_TRAIL],
      imports: [AuthPersistenceModule, AuditModule, ConfigModule],
      useFactory: (
        repository: AuthRepository,
        config: ConfigService<AppEnv, true>,
        trail: AuditTrail,
      ) => ({
        // This library re-enables Express's parsers on every route outside
        // /api/auth, so `@Body()` works here despite the app's own
        // `bodyParser: false`. `rawBody` additionally keeps the undecoded JSON
        // bytes on the request, which is the only thing a provider's webhook
        // signature can be checked against.
        bodyParser: { rawBody: true },
        auth: createAuth(repository, {
          baseURL: config.get("BETTER_AUTH_URL", { infer: true }),
          nodeEnv: config.get("NODE_ENV", { infer: true }),
          passkeyOrigins: config.get("PASSKEY_ORIGINS", { infer: true }),
          passkeyRpId: config.get("PASSKEY_RP_ID", { infer: true }),
          // The write itself belongs to `AuditTrail`, which `directory` also
          // uses. This factory only names it, so no auth code reaches into
          // another module's tables and the trail stays testable on its own.
          recordAudit: (event) => trail.record(event),
          secret: config.get("BETTER_AUTH_SECRET", { infer: true }),
          trustedOrigins: config.get("TRUSTED_ORIGINS", { infer: true }),
        }),
      }),
    }),
  ],
  providers: [
    OnboardingHook,
    IdentityOperationsService,
    { provide: ACCOUNT_LIFECYCLE, useClass: AccountLifecycleFacade },
  ],
  exports: [ACCOUNT_LIFECYCLE],
})
export class AuthModule {}
