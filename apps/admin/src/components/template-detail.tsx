import { Button } from "@repo/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/sheet";
import type { ReactNode } from "react";

import type { Template } from "../lib/notifications";
import { FIGURE, PANEL, SECTION } from "./admin-surface";
import {
  ChannelName,
  exactTime,
  MONO,
  relativeTime,
  TemplateStatus,
} from "./notification-status";

export function TemplateDetail({
  onClose,
  template,
}: {
  onClose: () => void;
  template: Template | null;
}) {
  return (
    <Sheet
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open={template !== null}
    >
      <SheetContent
        className="gap-0 p-0 sm:max-w-lg w-full overflow-y-auto overscroll-contain"
        side="right"
      >
        {template ? (
          <>
            <SheetHeader className="gap-1 px-4 py-3.5 border-b border-border">
              <SheetTitle
                className={`${MONO} font-medium text-[13px] break-words`}
              >
                {template.key}
              </SheetTitle>
              <SheetDescription className="gap-3 flex flex-wrap items-center">
                <TemplateStatus status={template.status} />
                <span className="gap-1.5 flex flex-wrap items-center text-muted-foreground">
                  <ChannelName channel={template.channel} />
                  <span>
                    · {template.locale} · v{template.version}
                  </span>
                </span>
              </SheetDescription>
            </SheetHeader>

            <div className="gap-4 px-4 py-4 flex flex-col">
              <dl className={`${PANEL} px-3`}>
                <Fact label="Updated">
                  <span
                    className={FIGURE}
                    title={exactTime(template.updatedAt)}
                  >
                    {relativeTime(template.updatedAt)}
                  </span>
                </Fact>
                <Fact label="Variables">
                  {template.variables.length
                    ? template.variables.join(", ")
                    : "None"}
                </Fact>
              </dl>

              <section>
                <h3 className={SECTION}>Template content</h3>
                <div className={`${PANEL} mt-2`}>
                  {template.subject ? (
                    <p className="px-3 py-2 font-medium border-b border-border/60 text-[13px] break-words">
                      {template.subject}
                    </p>
                  ) : null}
                  <pre className="px-3 py-2.5 leading-relaxed text-[13px] [overflow-wrap:anywhere] break-words whitespace-pre-wrap">
                    {template.body}
                  </pre>
                </div>
              </section>
            </div>

            <div className="px-4 py-3 mt-auto border-t border-border">
              <Button onClick={onClose} size="sm" variant="ghost">
                Close
              </Button>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
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
        className={`${mono ? MONO : "text-[13px]"} min-w-0 text-right [overflow-wrap:anywhere] break-words`}
      >
        {children}
      </dd>
    </div>
  );
}
