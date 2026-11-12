import type {
  MessageStatus,
  SuppressionReason,
} from "@repo/contracts/notifications";

/**
 * One provider's word on one message. `suppress` is set when the outcome says
 * this destination must not be written to again — a hard bounce, a complaint,
 * an opt-out — which is the part no provider tells the other two about.
 */
export interface Receipt {
  providerId: string;
  status: "bounced" | "delivered" | "sent";
  destination: string | null;
  suppress: SuppressionReason | null;
}

/**
 * The message statuses a receipt may replace. Providers do not promise to
 * deliver their webhooks in order, so a late `email.sent` or
 * `delivery_delayed` must not turn a delivered message back into a sent one.
 * A bounce outranks a delivery: it is the later and the more useful news.
 */
export const replaceableBy = (
  status: Receipt["status"],
): readonly MessageStatus[] =>
  (
    {
      bounced: ["sent", "delivered", "bounced"],
      delivered: ["sent", "delivered"],
      sent: ["sent"],
    } satisfies Record<Receipt["status"], MessageStatus[]>
  )[status];
