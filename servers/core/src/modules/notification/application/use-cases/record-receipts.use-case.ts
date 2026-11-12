import { Inject, Injectable } from "@nestjs/common";

import { Suppression } from "../../domain/entities/suppression.entity";
import {
  MESSAGE_REPOSITORY,
  type MessageRepository,
} from "../../domain/repositories/message.repository";
import {
  SUPPRESSION_REPOSITORY,
  type SuppressionRepository,
} from "../../domain/repositories/suppression.repository";
import {
  channelOf,
  type ProviderName,
} from "../../domain/value-objects/carrier.vo";
import type { Receipt } from "../../domain/value-objects/delivery-receipt.vo";

/**
 * What a provider says became of the messages it carried.
 *
 * A receipt that ends the destination's usefulness — a hard bounce, a
 * complaint, an opt-out — raises a suppression as well as closing the message,
 * because that is the part no provider tells the other two about.
 */
@Injectable()
export class RecordReceiptsUseCase {
  constructor(
    @Inject(MESSAGE_REPOSITORY) private readonly messages: MessageRepository,
    @Inject(SUPPRESSION_REPOSITORY)
    private readonly suppressions: SuppressionRepository,
  ) {}

  async execute(
    provider: ProviderName,
    receipts: readonly Receipt[],
  ): Promise<void> {
    const channel = channelOf(provider);

    for (const receipt of receipts) {
      await this.messages.applyReceipt(receipt);

      if (receipt.suppress === null || receipt.destination === null) continue;

      await this.suppressions.add(
        Suppression.raise({
          channel,
          destination: receipt.destination,
          reason: receipt.suppress,
        }),
      );
    }
  }
}
