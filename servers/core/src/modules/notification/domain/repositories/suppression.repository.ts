import type { Suppression } from "../entities/suppression.entity";
import type { NotificationChannel } from "../value-objects/notification-channel.vo";

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

  /** False when there was no suppression with that id. */
  lift(id: string): Promise<boolean>;
}
