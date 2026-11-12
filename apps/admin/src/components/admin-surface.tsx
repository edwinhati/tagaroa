import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import type { ReactNode } from "react";

/**
 * Literal strings only — keys, IDs, destinations, secrets.
 * Never counts, clocks, or prose; those use FIGURE or body sans.
 */
export const MONO = "font-mono text-[12.5px] tracking-[-0.01em]";

/** Live figures and clocks — UI sans at tabular widths, no mono costume. */
export const FIGURE = "text-[12.5px] tracking-[-0.01em] tabular-nums";

/** Table / form column chrome only — not section titles. */
export const COLUMN =
  "text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground";

/**
 * Lifted product work surface: solid card ground, thin border, soft panel shadow.
 * Uses design tokens so radius and elevation stay in sync with tagaroa.css.
 */
export const PANEL = cn(
  "overflow-hidden rounded-[var(--panel-radius)] bg-card text-card-foreground",
  "border border-border",
  "shadow-[var(--panel-shadow)]",
);

/** Outer stack for collection screens. Chrome stays dense; sections still breathe. */
export const COLLECTION = "gap-6 flex flex-col";

/**
 * Flat filter / toolbar row. No card chrome — sit on bone or inside a PANEL
 * (with an optional hairline separator on the consumer).
 */
export const TOOLBAR = "gap-3 sm:flex-row sm:items-center flex flex-col";

/** Section title — sentence case, sits above the card. */
export const SECTION =
  "text-[12.5px] font-medium tracking-[-0.01em] text-balance text-foreground";

export type MarkTone = "away" | "bad" | "done" | "waiting" | "quiet" | "warn";

/**
 * Dots carry the status triplet; labels stay ink except when the state is
 * something an operator should act on (danger, warning). Shape still
 * distinguishes hollow (not yet) from solid (settled).
 */
const DOT: Record<MarkTone, string> = {
  away: "bg-status-info-text",
  bad: "bg-status-danger-text",
  done: "bg-status-success-text",
  waiting: "border border-status-neutral-text/55",
  quiet: "bg-status-neutral-text/45",
  warn: "bg-status-warning-text",
};

const LABEL: Record<MarkTone, string | undefined> = {
  away: undefined,
  bad: "text-status-danger-text",
  done: undefined,
  waiting: undefined,
  quiet: undefined,
  warn: "text-status-warning-text",
};

/** Status carried by a coloured dot from the five shipped triplets. */
export function Mark({
  className,
  label,
  tone,
}: {
  className?: string;
  label: string;
  tone: MarkTone;
}) {
  return (
    <span
      className={cn("gap-2 inline-flex items-center text-[13px]", className)}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 shrink-0 rounded-full", DOT[tone])}
      />
      <span className={LABEL[tone]}>{label}</span>
    </span>
  );
}

/**
 * Title above a primary work surface. Pass `framed={false}` for open content.
 * Keep descriptions short or omit — tool pages lead with the surface, not prose.
 */
export function SurfaceSection({
  children,
  className,
  description,
  framed = true,
  title,
  trailing,
}: {
  children: ReactNode;
  className?: string;
  description?: ReactNode;
  framed?: boolean;
  title: string;
  trailing?: ReactNode;
}) {
  return (
    <section className={cn("gap-2.5 flex flex-col", className)}>
      <div className="gap-3 flex items-end justify-between">
        <div className="min-w-0">
          <h2 className={SECTION}>{title}</h2>
          {description ? (
            <p className="mt-0.5 leading-relaxed text-[12px] text-pretty text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {trailing}
      </div>
      {framed ? <div className={PANEL}>{children}</div> : children}
    </section>
  );
}

const BANNER: Record<"quiet" | "info" | "warn" | "bad", string | undefined> = {
  quiet: undefined,
  info: "border-status-info-line bg-status-info-tint shadow-none",
  warn: "border-status-warning-line bg-status-warning-tint shadow-none",
  bad: "border-status-danger-line bg-status-danger-tint shadow-none",
};

const BANNER_DOT: Record<"quiet" | "info" | "warn" | "bad", string> = {
  quiet: "border border-status-neutral-text/55",
  info: "bg-status-info-text",
  warn: "bg-status-warning-text",
  bad: "bg-status-danger-text",
};

/** Mode note or warning — same card language, tinted from the status triplets. */
export function SurfaceBanner({
  children,
  tone = "quiet",
}: {
  children: ReactNode;
  tone?: "quiet" | "info" | "warn" | "bad";
}) {
  return (
    <div
      className={cn(
        PANEL,
        "gap-3 px-3.5 py-3 flex items-start text-[12.5px] text-muted-foreground",
        BANNER[tone],
      )}
    >
      <span
        aria-hidden="true"
        className={cn("mt-1 size-1.5 shrink-0 rounded-full", BANNER_DOT[tone])}
      />
      <div className="min-w-0 leading-relaxed flex-1">{children}</div>
    </div>
  );
}

export function Failed({
  error,
  framed = true,
  onRetry,
  what,
}: {
  error: Error | { message: string };
  framed?: boolean;
  onRetry?: () => void;
  what: string;
}) {
  return (
    <div className={cn(framed && PANEL, "px-4 py-12 text-center")} role="alert">
      <p className="font-medium text-[13px] text-balance">
        The {what} could not be loaded
      </p>
      <p className="mt-1.5 leading-relaxed mx-auto max-w-[52ch] text-[13px] text-pretty text-muted-foreground">
        {error.message}
      </p>
      {onRetry ? (
        <Button className="mt-4" onClick={onRetry} size="sm" variant="outline">
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function Nothing({
  children,
  framed = true,
  title,
}: {
  children?: ReactNode;
  framed?: boolean;
  title: string;
}) {
  return (
    <div className={cn(framed && PANEL, "px-4 py-12 text-center")}>
      <p className="font-medium text-[13px] text-balance">{title}</p>
      {children ? (
        <p className="mt-1.5 leading-relaxed mx-auto max-w-[52ch] text-[13px] text-pretty text-muted-foreground">
          {children}
        </p>
      ) : null}
    </div>
  );
}

/** Panel-shaped loading placeholder for collection screens. */
export function PanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div data-impeccable-carbonize="8d88c751" style={{ display: "contents" }}>
      {/* impeccable-carbonize-start 8d88c751 */}
      <style data-impeccable-css="8d88c751">{`
      @scope ([data-impeccable-variant="1"]) {
      :scope > .ps-table {
      display: flex;
      flex-direction: column;
      gap: calc(0.35rem + (1 - var(--p-density, 0.55)) * 0.45rem);
      padding: calc(0.65rem + (1 - var(--p-density, 0.55)) * 0.45rem);
      }
      :scope > .ps-table [data-skeleton-part="head"] {
      height: 1.75rem;
      max-width: 11rem;
      width: 32%;
      }
      :scope > .ps-table .ps-table-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      }
      :scope > .ps-table [data-skeleton-part="mark"] {
      height: 0.625rem;
      width: 0.625rem;
      flex-shrink: 0;
      border-radius: 50%;
      }
      :scope > .ps-table [data-skeleton-part="body"] {
      height: 2.25rem;
      flex: 1;
      min-width: 0;
      }
      :scope > .ps-table [data-skeleton-part="meta"] {
      height: 0.875rem;
      width: 3.5rem;
      flex-shrink: 0;
      }
      }
      `}</style>
      {/* impeccable-param-values 8d88c751: {"density":0.55} */}
      {/* impeccable-carbonize-end 8d88c751 */}
      <div data-impeccable-variant="1" style={{ display: "contents" }}>
        <div className={cn(PANEL, "ps-table")} aria-hidden="true">
          <Skeleton data-skeleton-part="head" />
          {Array.from({ length: rows }, (_, index) => (
            <div className="ps-table-row" key={index}>
              <Skeleton data-skeleton-part="mark" />
              <Skeleton data-skeleton-part="body" />
              <Skeleton data-skeleton-part="meta" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
