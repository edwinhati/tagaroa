import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import type { ApiDocument, Collection } from "@repo/contracts";
import { Roles, Session, type UserSession } from "@thallesp/nestjs-better-auth";

import {
  pageCollection,
  parseCollectionQuery,
  type QueryRecord,
} from "../../../platform/http/collection";
import { SessionOnly } from "../../../platform/http/session-only.decorator";
import type {
  DirectorySubsidiary,
  DirectoryTeam,
} from "../application/dto/group-snapshot.dto";
import { AssembleAdminDashboardUseCase } from "../application/use-cases/assemble-admin-dashboard.use-case";
import { GetGroupDirectoryUseCase } from "../application/use-cases/get-group-directory.use-case";
import {
  GetMyDirectoryProfileUseCase,
  type MyDirectoryProfile,
} from "../application/use-cases/get-my-directory-profile.use-case";
import { ListLinkedAccountsUseCase } from "../application/use-cases/list-linked-accounts.use-case";
import { ManagePositionUseCase } from "../application/use-cases/manage-position.use-case";
import { ReadPersonalEmailUseCase } from "../application/use-cases/read-personal-email.use-case";
import { RecordAccessReviewUseCase } from "../application/use-cases/record-access-review.use-case";
import { savePositionBody, type SavePositionBody } from "./directory.schemas";

const DIRECTORY_READ_ROLES = [
  "access-reviewer",
  "helpdesk",
  "admin",
  "super-admin",
] as const;

export type { DirectorySubsidiary, DirectoryTeam };

export interface Directory {
  positions: Collection<Awaited<ReturnType<ManagePositionUseCase["save"]>>>;
  subsidiaries: Collection<DirectorySubsidiary>;
  teams: Collection<DirectoryTeam>;
}

/**
 * The group's HTTP surface for `apps/admin`.
 *
 * Routing, roles and paging, and nothing else. Each route is one call into one
 * use case, so every rule behind them is reachable from a test without a
 * session or a server.
 */
@Controller("directory")
export class DirectoryController {
  constructor(
    private readonly getDirectory: GetGroupDirectoryUseCase,
    private readonly getMyProfile: GetMyDirectoryProfileUseCase,
    private readonly assembleDashboard: AssembleAdminDashboardUseCase,
    private readonly recordReview: RecordAccessReviewUseCase,
    private readonly listAccounts: ListLinkedAccountsUseCase,
    private readonly managePosition: ManagePositionUseCase,
    private readonly readPersonalEmail: ReadPersonalEmailUseCase,
  ) {}

  /**
   * The signed-in person's own titles and reporting lines. Any authenticated
   * session may call this; it never returns another person's row.
   */
  @Get("me")
  @SessionOnly()
  async me(
    @Session() session: UserSession,
  ): Promise<ApiDocument<MyDirectoryProfile>> {
    return {
      data: await this.getMyProfile.execute(session.user.id),
    };
  }

  @Get()
  @Roles([...DIRECTORY_READ_ROLES])
  async directory(
    @Query() rawQuery: QueryRecord,
  ): Promise<ApiDocument<Directory>> {
    const { positions, subsidiaries, teams } =
      await this.getDirectory.execute();
    const page = <T>(rows: T[], prefix: string) =>
      pageCollection(rows, parseCollectionQuery(rawQuery, { prefix }), {
        path: "/api/directory",
        prefix,
        rawQuery,
      });

    return {
      data: {
        positions: page(positions, "positions"),
        subsidiaries: page(subsidiaries, "subsidiaries"),
        teams: page(teams, "teams"),
      },
    };
  }

  @Put("positions/group/:userId")
  @Roles(["admin", "super-admin"])
  async saveGroupPosition(
    @Param("userId") userId: string,
    @Body({ schema: savePositionBody }) body: SavePositionBody,
    @Session() session: UserSession,
  ) {
    return {
      data: await this.managePosition.save({
        actorId: session.user.id,
        managerUserId: body.managerUserId,
        organizationId: null,
        title: body.title,
        userId,
      }),
    };
  }

  @Delete("positions/group/:userId")
  @Roles(["admin", "super-admin"])
  async removeGroupPosition(
    @Param("userId") userId: string,
    @Session() session: UserSession,
  ) {
    return {
      data: await this.managePosition.remove({
        actorId: session.user.id,
        organizationId: null,
        userId,
      }),
    };
  }

  @Put("positions/subsidiaries/:organizationId/:userId")
  @Roles(["admin", "super-admin"])
  async saveSubsidiaryPosition(
    @Param("organizationId") organizationId: string,
    @Param("userId") userId: string,
    @Body({ schema: savePositionBody }) body: SavePositionBody,
    @Session() session: UserSession,
  ) {
    return {
      data: await this.managePosition.save({
        actorId: session.user.id,
        managerUserId: body.managerUserId,
        organizationId,
        title: body.title,
        userId,
      }),
    };
  }

  @Delete("positions/subsidiaries/:organizationId/:userId")
  @Roles(["admin", "super-admin"])
  async removeSubsidiaryPosition(
    @Param("organizationId") organizationId: string,
    @Param("userId") userId: string,
    @Session() session: UserSession,
  ) {
    return {
      data: await this.managePosition.remove({
        actorId: session.user.id,
        organizationId,
        userId,
      }),
    };
  }

  @Get("dashboard")
  @Roles([...DIRECTORY_READ_ROLES])
  async overview(@Query() rawQuery: QueryRecord) {
    const model = await this.assembleDashboard.execute(new Date());
    const page = <T>(rows: T[], prefix: string) =>
      pageCollection(rows, parseCollectionQuery(rawQuery, { prefix }), {
        path: "/api/directory/dashboard",
        prefix,
        rawQuery,
      });

    return {
      data: {
        accessReview: {
          ...model.accessReview,
          people: page(model.accessReview.people, "accessReviewPeople"),
        },
        attention: page(model.attention, "attention"),
        counts: model.counts,
        events: page(model.events, "events"),
        people: page(model.people, "people"),
      },
    };
  }

  /**
   * Where a message to this person would go. Admin-only and one at a time,
   * which is the whole reason the column is `returned: false` on the account.
   */
  @Get("users/:userId/personal-email")
  @Roles(["helpdesk", "admin", "super-admin"])
  async personalEmail(
    @Param("userId") userId: string,
  ): Promise<{ data: { personalEmail: string | null } }> {
    return {
      data: { personalEmail: await this.readPersonalEmail.execute(userId) },
    };
  }

  @Post("access-reviews/:userId")
  @Roles(["access-reviewer", "admin", "super-admin"])
  async reviewPrivilegedAccess(
    @Param("userId") userId: string,
    @Session() session: UserSession,
  ): Promise<{ reviewed: true }> {
    const { impersonatedBy } = session.session as {
      impersonatedBy?: string | null;
    };
    await this.recordReview.execute(userId, {
      id: session.user.id,
      impersonatedBy,
    });
    return { reviewed: true };
  }

  @Get("users/:userId/accounts")
  @Roles([...DIRECTORY_READ_ROLES])
  async accounts(
    @Param("userId") userId: string,
    @Query() rawQuery: QueryRecord,
  ) {
    const rows = await this.listAccounts.execute(userId);
    return pageCollection(rows, parseCollectionQuery(rawQuery), {
      path: `/api/directory/users/${userId}/accounts`,
      rawQuery,
    });
  }
}
