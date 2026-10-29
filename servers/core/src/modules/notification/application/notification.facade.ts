import { Injectable } from "@nestjs/common";

import type { EnqueuedMessage } from "../domain/repositories/message.repository";
import {
  SendNotificationUseCase,
  type SendInput,
} from "./use-cases/send-notification.use-case";

export const NOTIFICATION_SENDER = Symbol("NOTIFICATION_SENDER");

export type { EnqueuedMessage, SendInput };

/**
 * The whole of what `notification` promises anyone outside it.
 *
 * `auth` depends on this interface and on nothing else in the module — not the
 * use case, not the entities, not the tables. The day messaging becomes its own
 * service, an HTTP or queue client is bound to `NOTIFICATION_SENDER` and no
 * caller changes.
 *
 * There is deliberately no HTTP route behind it. Every caller is a module in
 * this process today; an endpoint can be added when one is not, and will need
 * its own authentication rather than inheriting a session that in-process
 * callers never had.
 */
export interface NotificationSender {
  send(input: SendInput): Promise<EnqueuedMessage>;
}

@Injectable()
export class NotificationSenderFacade implements NotificationSender {
  constructor(private readonly sendNotification: SendNotificationUseCase) {}

  async send(input: SendInput): Promise<EnqueuedMessage> {
    return this.sendNotification.execute(input);
  }
}
