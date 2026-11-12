import { type ReactNode } from "react";

import { SECTION } from "../admin-surface";

/** One block of a tab's work surface: title, its content, an optional action. */
export function Row({
  action,
  children,
  title,
  trailing,
}: {
  action?: ReactNode;
  children: ReactNode;
  title: string;
  trailing?: ReactNode;
}) {
  return (
    <section className="gap-3 px-4 py-3.5 sm:flex-row sm:items-start flex flex-col border-t border-border first:border-t-0">
      <div className="min-w-0 flex-1">
        <div className="gap-3 flex items-baseline justify-between">
          <h3 className={SECTION}>{title}</h3>
          {trailing}
        </div>
        {children}
      </div>
      {action ? <div className="sm:shrink-0">{action}</div> : null}
    </section>
  );
}

export function MutedLine({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-[12.5px] text-muted-foreground">{children}</p>;
}
