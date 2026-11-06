import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import type { ApiDocument, Collection } from "@repo/contracts";
import { Roles, Session, type UserSession } from "@thallesp/nestjs-better-auth";

import type { QueryRecord } from "../../../platform/http/collection";
import type {
  MessageRow,
  NotificationOverview,
  SuppressionRow,
  TemplateRow,
} from "../application/dto/notification.read-models";
import {
  GetNotificationOverviewUseCase,
  ListMessagesUseCase,
  ListSuppressionsUseCase,
  LiftSuppressionUseCase,
} from "../application/use-cases/browse-notifications.use-cases";
import {
  CreateTemplateUseCase,
  DeleteTemplateUseCase,
  EditTemplateUseCase,
  ListTemplatesUseCase,
  PublishTemplateUseCase,
} from "../application/use-cases/manage-templates.use-cases";
import {
  editTemplateBody,
  templateDraftBody,
  type EditTemplateBody,
  type TemplateDraftBody,
} from "./notification.schemas";

/**
 * The wording and what became of it, for `apps/admin`.
 *
 * Routing, roles and paths — the three things that are true of an HTTP surface
 * and of nothing else. Each route names one use case and returns what it
 * answers; the rules about versions, publishing and suppressions live a layer
 * below, where they can be exercised without a request.
 */
@Controller("notifications")
@Roles(["admin", "super-admin"])
export class NotificationAdminController {
  constructor(
    private readonly getOverview: GetNotificationOverviewUseCase,
    private readonly listTemplates: ListTemplatesUseCase,
    private readonly createTemplateUseCase: CreateTemplateUseCase,
    private readonly editTemplateUseCase: EditTemplateUseCase,
    private readonly publishTemplateUseCase: PublishTemplateUseCase,
    private readonly deleteTemplateUseCase: DeleteTemplateUseCase,
    private readonly listMessages: ListMessagesUseCase,
    private readonly listSuppressions: ListSuppressionsUseCase,
    private readonly liftSuppression: LiftSuppressionUseCase,
  ) {}

  @Get("overview")
  async overview(
    @Query() rawQuery: QueryRecord,
  ): Promise<ApiDocument<NotificationOverview>> {
    return this.getOverview.execute(rawQuery, "/api/notifications/overview");
  }

  @Get("templates")
  async templates(
    @Query() rawQuery: QueryRecord,
  ): Promise<Collection<TemplateRow>> {
    return this.listTemplates.execute(rawQuery, "/api/notifications/templates");
  }

  @Post("templates")
  async createTemplate(
    @Body({ schema: templateDraftBody }) body: TemplateDraftBody,
    @Session() session: UserSession,
  ): Promise<{ id: string; version: number }> {
    return this.createTemplateUseCase.execute(body, session.user.id);
  }

  @Put("templates/:id")
  @HttpCode(204)
  async editTemplate(
    @Param("id") id: string,
    @Body({ schema: editTemplateBody })
    { expectedUpdatedAt, ...draft }: EditTemplateBody,
    @Session() session: UserSession,
  ): Promise<void> {
    await this.editTemplateUseCase.execute(
      id,
      draft,
      expectedUpdatedAt,
      session.user.id,
    );
  }

  @Post("templates/:id/publish")
  @HttpCode(204)
  async publishTemplate(
    @Param("id") id: string,
    @Session() session: UserSession,
  ): Promise<void> {
    await this.publishTemplateUseCase.execute(id, session.user.id);
  }

  @Delete("templates/:id")
  @HttpCode(204)
  async deleteTemplate(
    @Param("id") id: string,
    @Session() session: UserSession,
  ): Promise<void> {
    await this.deleteTemplateUseCase.execute(id, session.user.id);
  }

  @Get("messages")
  async messages(
    @Query() rawQuery: QueryRecord,
  ): Promise<Collection<MessageRow>> {
    return this.listMessages.execute(rawQuery, "/api/notifications/messages");
  }

  @Get("suppressions")
  async suppressions(
    @Query() rawQuery: QueryRecord,
  ): Promise<Collection<SuppressionRow>> {
    return this.listSuppressions.execute(
      rawQuery,
      "/api/notifications/suppressions",
    );
  }

  @Delete("suppressions/:id")
  @HttpCode(204)
  async lift(
    @Param("id") id: string,
    @Session() session: UserSession,
  ): Promise<void> {
    await this.liftSuppression.execute(id, session.user.id);
  }
}
