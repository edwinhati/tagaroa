import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@repo/ui";
import { ChevronsUpDownIcon } from "lucide-react";

export const Open = () => (
  <Collapsible defaultOpen className="w-72 p-3 rounded-lg border">
    <div className="flex items-center justify-between">
      <p className="text-sm font-medium">Session history — Ada Okonkwo</p>
      <CollapsibleTrigger className="size-7 inline-flex items-center justify-center rounded-md hover:bg-muted">
        <ChevronsUpDownIcon className="size-4" />
      </CollapsibleTrigger>
    </div>
    <CollapsibleContent className="mt-2 gap-1.5 text-sm flex flex-col text-muted-foreground">
      <p>Amsterdam, NL · Chrome on macOS · 2 minutes ago</p>
      <p>Amsterdam, NL · iOS app · yesterday, 18:42</p>
      <p>Lagos, NG · Chrome on Windows · 3 days ago</p>
    </CollapsibleContent>
  </Collapsible>
);

export const Closed = () => (
  <Collapsible className="w-72 p-3 rounded-lg border">
    <div className="flex items-center justify-between">
      <p className="text-sm font-medium">Emergency access — 4 grants</p>
      <CollapsibleTrigger className="size-7 inline-flex items-center justify-center rounded-md hover:bg-muted">
        <ChevronsUpDownIcon className="size-4" />
      </CollapsibleTrigger>
    </div>
    <CollapsibleContent className="mt-2 gap-1.5 text-sm flex flex-col text-muted-foreground">
      <p>Bram de Vries granted domain:administer for 15 minutes</p>
    </CollapsibleContent>
  </Collapsible>
);
