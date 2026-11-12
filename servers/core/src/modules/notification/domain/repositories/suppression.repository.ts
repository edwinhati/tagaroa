import type { NotificationChannel } from "@repo/contracts/notifications";

import type { Suppression } from "../entities/suppression.entity";

export const SUPPRESSION_REPOSITORY = Symbol("SUPPRESSION_REPOSITORY");

export interface SuppressionRepository {
  /** The reason this destination is refused on this channel, if it is. */
  reasonFor(
    channel: NotificationChannel,
    destination: string,
  ): Promise<string | undefined>;

  /** `channel:destination` for every destination named that is refused. */
  keysAmong(destinations: readonly string[]): Promise<Set<string>>;

  /** A repeat changes nothing: the first refusal is the one that counts. */
  add(suppression: Suppression): Promise<void>;

  /** The channel the lifted suppression was on; undefined when there was none. */
  lift(id: string): Promise<NotificationChannel | undefined>;
}
