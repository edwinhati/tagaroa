import { type Collection } from "@repo/contracts";
import {
  type MessageRow,
  type SuppressionRow,
} from "@repo/contracts/notifications";

import { type QueryRecord } from "../../../../platform/http/collection";
import { type DeliveryTallies } from "../dto/notification.read-models";

export const NOTIFICATION_QUERY = Symbol("NOTIFICATION_QUERY");

/**
 * Reading the log, as opposed to changing it.
 *
 * Separate from `MessageRepository` on purpose. That port loads and saves
 * message state one row at a time and answers in entities; this one filters,
 * facets, counts and pages in the database and answers in rows. Keeping them
 * apart is what lets the write side stay a domain model without dragging the
 * admin surface's paging through it — and what would let the two be served by
 * different stores later without either learning about the other.
 */
export interface NotificationQuery {
  pageMessages(
    rawQuery: QueryRecord,
    path: string,
  ): Promise<Collection<MessageRow>>;

  pageSuppressions(
    rawQuery: QueryRecord,
    path: string,
  ): Promise<Collection<SuppressionRow>>;

  /** Per-channel tallies and the fortnight's series, in one round of queries. */
  tallies(seriesDays: number): Promise<DeliveryTallies>;
}
