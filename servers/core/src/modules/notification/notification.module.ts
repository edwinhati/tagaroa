import { Logger, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";

import type { AppEnv } from "../../platform/config/env";
import { AuditModule } from "../audit/audit.module";
import {
  NOTIFICATION_SENDER,
  NotificationSenderFacade,
} from "./application/notification.facade";
import { NOTIFICATION_QUERY } from "./application/ports/notification-query.port";
import {
  GetNotificationOverviewUseCase,
  ListMessagesUseCase,
  ListSuppressionsUseCase,
  LiftSuppressionUseCase,
} from "./application/use-cases/browse-notifications.use-cases";
import { DrainQueueUseCase } from "./application/use-cases/drain-queue.use-case";
import {
  CreateTemplateUseCase,
  DeleteTemplateUseCase,
  EditTemplateUseCase,
  ListTemplatesUseCase,
  PublishTemplateUseCase,
} from "./application/use-cases/manage-templates.use-cases";
import { RecordReceiptsUseCase } from "./application/use-cases/record-receipts.use-case";
import { SendNotificationUseCase } from "./application/use-cases/send-notification.use-case";
import { MESSAGE_CARRIER } from "./domain/repositories/message-carrier.port";
import { MESSAGE_REPOSITORY } from "./domain/repositories/message.repository";
import { NOTIFICATION_UNIT_OF_WORK } from "./domain/repositories/notification.unit-of-work";
import { SUPPRESSION_REPOSITORY } from "./domain/repositories/suppression.repository";
import { TEMPLATE_REPOSITORY } from "./domain/repositories/template.repository";
import {
  CHANNEL_STATUS,
  channelStatus,
} from "./domain/services/channel-status.service";
import {
  ChannelCarrier,
  type NotificationProviders,
} from "./infrastructure/channels/channel.factory";
import {
  DISPATCH_OPTIONS,
  type DispatchOptions,
  WEBHOOK_SECRETS,
  type WebhookSecrets,
  WORDING_OPTIONS,
  type WordingOptions,
} from "./infrastructure/config/notification.options";
import { DrizzleMessageRepository } from "./infrastructure/persistence/drizzle/drizzle-message.repository";
import { DrizzleNotificationQuery } from "./infrastructure/persistence/drizzle/drizzle-notification.query";
import { DrizzleNotificationUnitOfWork } from "./infrastructure/persistence/drizzle/drizzle-notification.unit-of-work";
import { DrizzleSuppressionRepository } from "./infrastructure/persistence/drizzle/drizzle-suppression.repository";
import { DrizzleTemplateRepository } from "./infrastructure/persistence/drizzle/drizzle-template.repository";
import { NotificationDispatcher } from "./infrastructure/scheduling/notification.dispatcher";
import { NotificationAdminController } from "./presentation/notification.admin.controller";
import { NotificationWebhookController } from "./presentation/notification.webhook.controller";

type Env = ConfigService<AppEnv, true>;

const read =
  (config: Env) =>
  <Key extends keyof AppEnv>(key: Key): AppEnv[Key] =>
    config.get(key, { infer: true });

/**
 * The credentials that send. A channel with an incomplete set is left out
 * rather than half-configured — `validateEnv` already refuses a partial one, so
 * absent here means deliberately absent.
 */
const providers = (config: Env): NotificationProviders => {
  const get = read(config);
  const resendKey = get("RESEND_API_KEY");
  const resendFrom = get("RESEND_FROM");
  const twilioSid = get("TWILIO_ACCOUNT_SID");
  const twilioToken = get("TWILIO_AUTH_TOKEN");
  const twilioFrom = get("TWILIO_FROM");
  const whatsappPhoneNumberId = get("WHATSAPP_PHONE_NUMBER_ID");
  const whatsappToken = get("WHATSAPP_TOKEN");

  return {
    // A channel sends as soon as it holds credentials, in any environment; one
    // without them writes to the log, except in production where silence is
    // worse than a failure. `env.ts`'s `allOrNothing` already guarantees a
    // provider's settings arrive complete or not at all, so a half-configured
    // channel cannot reach here.
    strict: get("NODE_ENV") === "production",
    ...(resendKey && resendFrom
      ? { resend: { apiKey: resendKey, from: resendFrom } }
      : {}),
    ...(twilioSid && twilioToken && twilioFrom
      ? {
          twilio: {
            accountSid: twilioSid,
            authToken: twilioToken,
            from: twilioFrom,
            statusCallback: `${get("NOTIFICATION_WEBHOOK_URL")}/twilio`,
          },
        }
      : {}),
    ...(whatsappPhoneNumberId && whatsappToken
      ? {
          whatsapp: {
            apiVersion: get("WHATSAPP_API_VERSION"),
            phoneNumberId: whatsappPhoneNumberId,
            token: whatsappToken,
          },
        }
      : {}),
  };
};

/**
 * Messages out of the workspace, on three channels.
 *
 * The module owns no recipients: a caller passes an address or a number, which
 * is what lets the same path serve staff onboarding and a message to someone
 * outside the group. What it does own is the wording (`notification.template`,
 * edited in `apps/admin`), the queue and audit trail (`notification.message` —
 * one row, both jobs), and who must not be written to again
 * (`notification.suppression`).
 *
 * There is no broker. The message row is the queue: `SendNotificationUseCase`
 * inserts it inside the unit of work, so a message cannot exist without its
 * cause or a cause without its message, and the dispatcher claims due rows with
 * `for update skip locked`. Publishing `notification.sent` onto Kafka for other
 * systems to consume is a different job from delivering one message, and
 * belongs beside `DrainQueueUseCase` when a consumer for it exists.
 *
 * Every port is bound to its adapter here and nowhere else — the five Drizzle
 * repositories, the carrier that resolves to Resend, Twilio or Meta, and the
 * read-side query. This is the only file in the module that decides the store
 * is Postgres and the providers are those three.
 *
 * Only `NOTIFICATION_SENDER` is exported. `auth` depends on that interface and
 * on nothing else here, so the day messaging becomes its own service an HTTP or
 * queue client is bound to the same token and no caller changes.
 *
 * Configuration is four tokens rather than one bag, each holding what one
 * consumer needs. The webhook routes in particular never receive the sending
 * credentials — only the Twilio token they must verify a signature against.
 */
@Module({
  controllers: [NotificationAdminController, NotificationWebhookController],
  exports: [NOTIFICATION_SENDER],
  imports: [AuditModule, ConfigModule],
  providers: [
    CreateTemplateUseCase,
    DeleteTemplateUseCase,
    DrainQueueUseCase,
    EditTemplateUseCase,
    GetNotificationOverviewUseCase,
    ListMessagesUseCase,
    ListSuppressionsUseCase,
    ListTemplatesUseCase,
    LiftSuppressionUseCase,
    NotificationDispatcher,
    PublishTemplateUseCase,
    RecordReceiptsUseCase,
    SendNotificationUseCase,
    { provide: NOTIFICATION_SENDER, useClass: NotificationSenderFacade },
    { provide: MESSAGE_REPOSITORY, useClass: DrizzleMessageRepository },
    { provide: SUPPRESSION_REPOSITORY, useClass: DrizzleSuppressionRepository },
    { provide: TEMPLATE_REPOSITORY, useClass: DrizzleTemplateRepository },
    {
      provide: NOTIFICATION_UNIT_OF_WORK,
      useClass: DrizzleNotificationUnitOfWork,
    },
    { provide: NOTIFICATION_QUERY, useClass: DrizzleNotificationQuery },
    {
      inject: [ConfigService],
      provide: MESSAGE_CARRIER,
      useFactory: (config: Env) =>
        new ChannelCarrier(providers(config), new Logger("Notification")),
    },
    {
      inject: [ConfigService],
      provide: WORDING_OPTIONS,
      useFactory: (config: Env): WordingOptions => ({
        defaultLocale: read(config)("NOTIFICATION_DEFAULT_LOCALE"),
      }),
    },
    {
      inject: [ConfigService],
      provide: DISPATCH_OPTIONS,
      useFactory: (config: Env): DispatchOptions => {
        const get = read(config);
        return {
          batchSize: get("NOTIFICATION_BATCH_SIZE"),
          maxAttempts: get("NOTIFICATION_MAX_ATTEMPTS"),
          pollMilliseconds: get("NOTIFICATION_POLL_MS"),
          providers: providers(config),
          worker: get("NOTIFICATION_WORKER"),
        };
      },
    },
    {
      inject: [ConfigService],
      provide: WEBHOOK_SECRETS,
      useFactory: (config: Env): WebhookSecrets => {
        const get = read(config);
        return {
          baseUrl: get("NOTIFICATION_WEBHOOK_URL"),
          metaAppSecret: get("WHATSAPP_APP_SECRET"),
          metaVerifyToken: get("WHATSAPP_VERIFY_TOKEN"),
          resendSecret: get("RESEND_WEBHOOK_SECRET"),
          twilioAuthToken: get("TWILIO_AUTH_TOKEN"),
        };
      },
    },
    {
      inject: [ConfigService],
      provide: CHANNEL_STATUS,
      useFactory: (config: Env) => channelStatus(providers(config)),
    },
  ],
})
export class NotificationModule {}
