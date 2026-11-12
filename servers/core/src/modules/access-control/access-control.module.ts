import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";

import { AuditModule } from "../audit/audit.module";
import { ACCESS_CONTROL } from "./application/access-control.facade";
import { AccessControlService } from "./application/access-control.service";
import { AccessReviewService } from "./application/access-review.service";
import { DomainAccessService } from "./application/domain-access.service";
import { ACCESS_CONTROL_REPOSITORY } from "./domain/repositories/access-control.repository";
import { ACCESS_REVIEW_REPOSITORY } from "./domain/repositories/access-review.repository";
import { DOMAIN_ACCESS_REPOSITORY } from "./domain/repositories/domain-access.repository";
import { DrizzleAccessControlRepository } from "./infrastructure/persistence/drizzle/drizzle-access-control.repository";
import { DrizzleAccessReviewRepository } from "./infrastructure/persistence/drizzle/drizzle-access-review.repository";
import { DrizzleDomainAccessRepository } from "./infrastructure/persistence/drizzle/drizzle-domain-access.repository";
import { AccessControlController } from "./presentation/access-control.controller";
import { AccessControlGuard } from "./presentation/access-control.guard";

@Module({
  controllers: [AccessControlController],
  imports: [AuditModule],
  providers: [
    AccessControlService,
    AccessReviewService,
    DomainAccessService,
    {
      provide: DOMAIN_ACCESS_REPOSITORY,
      useClass: DrizzleDomainAccessRepository,
    },
    {
      provide: ACCESS_REVIEW_REPOSITORY,
      useClass: DrizzleAccessReviewRepository,
    },
    {
      provide: ACCESS_CONTROL_REPOSITORY,
      useClass: DrizzleAccessControlRepository,
    },
    { provide: ACCESS_CONTROL, useExisting: AccessControlService },
    { provide: APP_GUARD, useClass: AccessControlGuard },
  ],
})
export class AccessControlModule {}
