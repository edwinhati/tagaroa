import {
  Avatar,
  AvatarFallback,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@repo/ui";

export const Open = () => (
  <HoverCard defaultOpen>
    <HoverCardTrigger className="text-sm font-medium underline underline-offset-4">
      Ada Okonkwo
    </HoverCardTrigger>
    <HoverCardContent>
      <div className="gap-3 flex items-start">
        <Avatar className="size-9">
          <AvatarFallback>AO</AvatarFallback>
        </Avatar>
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium">Ada Okonkwo</p>
          <p className="text-xs text-muted-foreground">
            Head of supply chain · joined Mar 2022
          </p>
          <p className="text-xs text-muted-foreground">
            Signed in 4 minutes ago from Amsterdam, NL
          </p>
        </div>
      </div>
    </HoverCardContent>
  </HoverCard>
);

export const TeamOpen = () => (
  <HoverCard defaultOpen>
    <HoverCardTrigger className="text-sm font-medium underline underline-offset-4">
      Supply chain
    </HoverCardTrigger>
    <HoverCardContent side="right">
      <div className="space-y-1">
        <p className="text-sm font-medium">Supply chain</p>
        <p className="text-xs text-muted-foreground">4 teams · 27 people</p>
        <p className="text-xs text-muted-foreground">
          Domain administrator: Ada Okonkwo
        </p>
      </div>
    </HoverCardContent>
  </HoverCard>
);
