import type {
  MessageStatus,
  SuppressionReason,
} from "@repo/contracts/notifications";
import { cn } from "@repo/ui/lib/utils";
import { MailIcon, SmartphoneIcon, type LucideIcon } from "lucide-react";

import { COLUMN, FIGURE, Mark, MONO, type MarkTone } from "./admin-surface";
import { WhatsAppMark } from "./brand-mark";

export { COLUMN, FIGURE, MONO };

/**
 * The vocabulary of a message's life, in one place.
 *
 * Each state maps onto the shipped status triplets: hollow-neutral while a
 * message is still in flight, solid info once it has left, solid success when
 * a receipt arrives, and danger when it has failed. Shape stays the second
 * channel so colour is never the only signal.
 */
const STATUS = {
  bounced: { label: "Bounced", tone: "bad" },
  delivered: { label: "Delivered", tone: "done" },
  failed: { label: "Failed", tone: "bad" },
  pending: { label: "Queued", tone: "waiting" },
  sending: { label: "Sending", tone: "waiting" },
  sent: { label: "Sent", tone: "away" },
  suppressed: { label: "Suppressed", tone: "bad" },
} as const satisfies Record<MessageStatus, { label: string; tone: MarkTone }>;

export const statusLabel = (status: string): string =>
  STATUS[status as MessageStatus]?.label ?? status;

const REASON = {
  bounced: "Bounced",
  complained: "Complained",
  failed: "Failed",
  "opted-out": "Opted out",
} as const satisfies Record<SuppressionReason, string>;

/** Why a destination is suppressed: its own words, not a message's status. */
export const reasonLabel = (reason: string): string =>
  REASON[reason as SuppressionReason] ?? reason;

export function Status({
  className,
  status,
}: {
  className?: string;
  status: string;
}) {
  const entry = STATUS[status as keyof typeof STATUS];
  const tone: MarkTone = entry?.tone ?? "waiting";

  return (
    <Mark className={className} label={entry?.label ?? status} tone={tone} />
  );
}

export const exactTime = (value: string | Date | null): string =>
  value ? new Date(value).toLocaleString() : "";

/**
 * A template's life is not a message's: it is written, published, and retired.
 * Borrowing the message vocabulary here printed "Delivered" beside a template,
 * which is nonsense — so the two have separate words.
 */
export function TemplateStatus({ status }: { status: string }) {
  const published = status === "published";
  const archived = status === "archived";

  return (
    <Mark
      className={cn(archived ? "text-muted-foreground" : undefined)}
      label={published ? "Published" : archived ? "Retired" : "Draft"}
      tone={published ? "done" : archived ? "quiet" : "waiting"}
    />
  );
}

/** Channels wear their own names; `capitalize` turns sms into "Sms". */
const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  sms: "SMS",
  whatsapp: "WhatsApp",
};

const CHANNEL_ICONS: Record<string, LucideIcon> = {
  email: MailIcon,
  sms: SmartphoneIcon,
};

export const channelLabel = (channel: string): string =>
  CHANNEL_LABELS[channel] ?? channel;

/**
 * Channel name with its mark. WhatsApp uses the brand glyph; email and SMS
 * stay Lucide outlines so they do not pretend to be a provider.
 */
export function ChannelName({
  active = false,
  channel,
  className,
}: {
  active?: boolean;
  channel: string;
  className?: string;
}) {
  const Icon = CHANNEL_ICONS[channel];

  return (
    <span className={cn("gap-1.5 inline-flex items-center", className)}>
      {channel === "whatsapp" ? (
        <WhatsAppMark />
      ) : Icon ? (
        <Icon
          aria-hidden="true"
          className="size-3.5 shrink-0"
          fill={active ? "currentColor" : "none"}
          strokeWidth={1.5}
        />
      ) : null}
      {channelLabel(channel)}
    </span>
  );
}
