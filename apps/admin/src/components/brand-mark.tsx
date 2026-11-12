import { cn } from "@repo/ui/lib/utils";
import { WhatsApp } from "@ridemountainpig/svgl-react";

const MARK = "size-3.5 shrink-0";

/** Channel marks that have a recognisable brand; others stay Lucide. */
export function WhatsAppMark({ className }: { className?: string }) {
  return (
    <WhatsApp
      aria-hidden
      className={cn(MARK, className)}
      height={14}
      width={14}
    />
  );
}
