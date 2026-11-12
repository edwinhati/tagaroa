import { Inject, Injectable } from "@nestjs/common";

import { IntervalJob } from "../../../../platform/scheduling/interval-job";
import {
  DISPATCH_OPTIONS,
  type DispatchOptions,
} from "../../application/notification.options";
import { DrainQueueUseCase } from "../../application/use-cases/drain-queue.use-case";

/**
 * The timer, and only the timer.
 *
 * What a pass does is `DrainQueueUseCase`; when a pass happens is here, because
 * running on an interval is a fact about this deployment rather than about
 * sending. `NOTIFICATION_WORKER=0` turns it off, so moving the dispatcher into
 * its own process means a second entrypoint calling the same use case, not a
 * rewrite — and `for update skip locked` already makes two of them safe. A pass
 * cut off by shutdown would have handed a message to a provider without marking
 * it sent, so it would go out twice; `IntervalJob` waits for it.
 */
@Injectable()
export class NotificationDispatcher extends IntervalJob {
  protected readonly failure =
    "Dispatcher pass failed; inspect notification state and provider health";

  constructor(
    private readonly drainQueue: DrainQueueUseCase,
    @Inject(DISPATCH_OPTIONS) private readonly options: DispatchOptions,
  ) {
    super();
  }

  protected schedule() {
    if (this.options.worker)
      return { atStartup: false, everyMs: this.options.pollMilliseconds };
    this.logger.log("Dispatcher disabled; nothing will be sent");
    return null;
  }

  protected run(): Promise<void> {
    return this.drainQueue.execute();
  }
}
