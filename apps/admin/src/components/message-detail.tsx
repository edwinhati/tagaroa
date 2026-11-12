import { Button } from "@repo/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/sheet";
import { relativeTime } from "@repo/ui/lib/relative-time";
import type { ReactNode } from "react";

import type { Message } from "../lib/notifications";
import { FIGURE, PANEL, SECTION } from "./admin-surface";
import {
  ChannelName,
  exactTime,
  MONO,
  Status,
  statusLabel,
} from "./notification-status";

/**
 * One message, in full.
 *
 * The point of the panel is the body: "did they get it" is only half the
 * question, and "what did it say" is the half a log usually cannot answer. The
 * wording shown here is what was rendered when the message was enqueued, so it
 * is what the recipient saw even if the template has been edited since.
 */
export function MessageDetail({
  message,
  onClose,
}: {
  message: Message | null;
  onClose: () => void;
}) {
  return (
    <Sheet
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open={message !== null}
    >
      <SheetContent
        className="gap-0 p-0 sm:max-w-lg w-full overflow-y-auto overscroll-contain"
        side="right"
      >
        {message ? <Detail message={message} onClose={onClose} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function Detail({
  message,
  onClose,
}: {
  message: Message;
  onClose: () => void;
}) {
  const failed = message.status === "failed" || message.status === "bounced";

  return (
    <>
      <SheetHeader className="gap-1 px-4 py-3.5 border-b border-border">
        <SheetTitle className={`${MONO} font-medium text-[13px]`}>
          {message.key}
        </SheetTitle>
        <SheetDescription className="gap-3 flex items-center">
          <Status status={message.status} />
          <span className="text-muted-foreground">
            <ChannelName channel={message.channel} className="inline-flex" /> ·{" "}
            {message.locale}
          </span>
        </SheetDescription>
      </SheetHeader>

      <div className="gap-4 px-4 py-4 flex flex-col">
        <Timeline message={message} />

        <Facts>
          <Fact label="To" mono>
            {message.destination}
          </Fact>
          <Fact label="Attempts">{message.attempts}</Fact>
          <Fact label="Provider id" mono>
            {message.providerId ?? "—"}
          </Fact>
        </Facts>

        {failed && message.error ? (
          <section
            className={`${PANEL} px-3.5 py-3 border-status-danger-line bg-status-danger-tint shadow-none`}
          >
            <h3 className="font-medium text-[13px] text-status-danger-text">
              Why it failed
            </h3>
            <p className="mt-1 leading-relaxed text-[13px] break-words text-muted-foreground">
              {message.error}
            </p>
          </section>
        ) : null}

        <section>
          <h3 className={SECTION}>What was sent</h3>
          <div className={`${PANEL} mt-2`}>
            {message.subject ? (
              <p className="px-3 py-2 font-medium border-b border-border/60 text-[13px] break-words">
                {message.subject}
              </p>
            ) : null}
            <pre className="px-3 py-2.5 leading-relaxed text-[13px] [overflow-wrap:anywhere] break-words whitespace-pre-wrap">
              {message.body}
            </pre>
          </div>
          {message.channel === "whatsapp" ? (
            <p className="mt-2 text-[12.5px] text-muted-foreground">
              WhatsApp carries the name of an approved template, not the text —
              Meta renders the wording it holds.
            </p>
          ) : null}
        </section>
      </div>

      <div className="px-4 py-3 mt-auto border-t border-border">
        <Button onClick={onClose} size="sm" variant="ghost">
          Close
        </Button>
      </div>
    </>
  );
}

/** Queued, away, settled: the three moments a message actually has. */
function Timeline({ message }: { message: Message }) {
  // A message that has already ended has no "not yet" left in it, whatever the
  // row happens to hold for its finishing time.
  const settled = !["pending", "sending"].includes(message.status);
  const steps = [
    { at: message.createdAt, label: "Queued" },
    { at: message.sentAt, label: "Handed to the provider" },
    {
      at: message.completedAt,
      label:
        message.status === "delivered"
          ? "Delivered"
          : message.status === "suppressed"
            ? "Refused before sending"
            : statusLabel(message.status),
    },
  ];

  return (
    <ol className="flex flex-col">
      {steps.map((step, index) => (
        <li className="gap-3 flex" key={step.label}>
          <div className="pt-1 flex flex-col items-center">
            <span
              aria-hidden="true"
              className={`size-1.5 rounded-full ${step.at ? "bg-foreground" : "border border-muted-foreground/40"}`}
            />
            {index < steps.length - 1 ? (
              <span
                aria-hidden="true"
                className={`w-px flex-1 ${step.at ? "bg-border" : "bg-border/50"}`}
              />
            ) : null}
          </div>
          <div className="pb-4 last:pb-0">
            <p
              className={`text-[13px] ${step.at ? "" : "text-muted-foreground"}`}
            >
              {step.label}
            </p>
            <p
              className={`${FIGURE} text-muted-foreground`}
              title={exactTime(step.at)}
            >
              {step.at
                ? relativeTime(step.at)
                : settled
                  ? "time not recorded"
                  : "not yet"}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Facts({ children }: { children: ReactNode }) {
  return <dl className={`${PANEL} px-3 flex flex-col`}>{children}</dl>;
}

function Fact({
  children,
  label,
  mono = false,
}: {
  children: ReactNode;
  label: string;
  mono?: boolean;
}) {
  return (
    <div className="gap-4 py-2 flex items-baseline justify-between">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd
        className={`${mono ? MONO : FIGURE} min-w-0 text-right [overflow-wrap:anywhere] break-words`}
      >
        {children}
      </dd>
    </div>
  );
}
