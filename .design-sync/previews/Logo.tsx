import { Logo } from "@repo/ui";

export const Sizes = () => (
  <div className="gap-6 flex items-end text-foreground">
    <Logo size={16} />
    <Logo size={24} />
    <Logo size={33} />
    <Logo size={48} />
    <Logo size={64} />
  </div>
);

export const OnDark = () => (
  <div className="gap-6 p-6 flex items-center rounded-md bg-foreground text-background">
    <Logo size={33} />
    <Logo size={48} />
  </div>
);

export const InHeader = () => (
  <div className="gap-2 p-3 flex items-center rounded-md border text-foreground">
    <Logo size={24} />
    <span className="text-sm font-semibold">Tagaroa</span>
  </div>
);
