import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { AssembleAdminDashboardUseCase } from "./application/use-cases/assemble-admin-dashboard.use-case";
import { GetGroupDirectoryUseCase } from "./application/use-cases/get-group-directory.use-case";
import { GetMyDirectoryProfileUseCase } from "./application/use-cases/get-my-directory-profile.use-case";
import { ListLinkedAccountsUseCase } from "./application/use-cases/list-linked-accounts.use-case";
import { ManagePositionUseCase } from "./application/use-cases/manage-position.use-case";
import { ReadPersonalEmailUseCase } from "./application/use-cases/read-personal-email.use-case";
import { RecordAccessReviewUseCase } from "./application/use-cases/record-access-review.use-case";
import { ACCESS_REVIEW_REPOSITORY } from "./domain/repositories/access-review.repository";
import { PERSON_REPOSITORY } from "./domain/repositories/person.repository";
import { POSITION_REPOSITORY } from "./domain/repositories/position.repository";
import { SESSION_REPOSITORY } from "./domain/repositories/session.repository";
import { SUBSIDIARY_REPOSITORY } from "./domain/repositories/subsidiary.repository";
import { DrizzleAccessReviewRepository } from "./infrastructure/persistence/drizzle/drizzle-access-review.repository";
import { DrizzlePersonRepository } from "./infrastructure/persistence/drizzle/drizzle-person.repository";
import { DrizzlePositionRepository } from "./infrastructure/persistence/drizzle/drizzle-position.repository";
import { DrizzleSessionRepository } from "./infrastructure/persistence/drizzle/drizzle-session.repository";
import { DrizzleSubsidiaryRepository } from "./infrastructure/persistence/drizzle/drizzle-subsidiary.repository";
import { DirectoryController } from "./presentation/directory.controller";

/**
 * The group as an admin sees it.
 *
 * It owns positions and `directory.privileged_access_review`,
 * and reads the `auth` tables Better Auth's own endpoints will not answer for
 * a caller who is not a member. It records what it does through `AUDIT_TRAIL`
 * rather than writing the trail itself.
 *
 * Every port is bound to a Drizzle adapter here and nowhere else, which is the
 * only place in the module that decides the store is Postgres.
 */
@Module({
  controllers: [DirectoryController],
  imports: [AuditModule],
  providers: [
    AssembleAdminDashboardUseCase,
    GetGroupDirectoryUseCase,
    GetMyDirectoryProfileUseCase,
    ListLinkedAccountsUseCase,
    ManagePositionUseCase,
    ReadPersonalEmailUseCase,
    RecordAccessReviewUseCase,
    {
      provide: ACCESS_REVIEW_REPOSITORY,
      useClass: DrizzleAccessReviewRepository,
    },
    { provide: PERSON_REPOSITORY, useClass: DrizzlePersonRepository },
    { provide: POSITION_REPOSITORY, useClass: DrizzlePositionRepository },
    { provide: SESSION_REPOSITORY, useClass: DrizzleSessionRepository },
    { provide: SUBSIDIARY_REPOSITORY, useClass: DrizzleSubsidiaryRepository },
  ],
})
export class DirectoryModule {}
