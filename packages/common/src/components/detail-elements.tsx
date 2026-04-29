import { cn } from "@repo/ui/lib/utils";

export function SectionHeader({
  icon: Icon,
  title,
}: Readonly<{
  icon: React.ElementType;
  title: string;
}>) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon size={14} />
      <span className="text-xs font-semibold uppercase tracking-wider">
        {title}
      </span>
    </div>
  );
}

export function PropertyRow({
  label,
  value,
  className,
}: Readonly<{
  label: string;
  value: React.ReactNode;
  className?: string;
}>) {
  return (
    <div
      className={cn(
        "flex items-center justify-between py-2.5 border-b border-border/50 last:border-0",
        className,
      )}
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}
