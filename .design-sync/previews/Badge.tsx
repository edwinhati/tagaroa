import { Badge } from "@repo/ui";
import { CheckCircle2Icon } from "lucide-react";

export const Variants = () => (
  <div className="gap-2 max-w-md flex flex-wrap items-center">
    <Badge variant="default">Active</Badge>
    <Badge variant="secondary">Invited</Badge>
    <Badge variant="destructive">Suspended</Badge>
    <Badge variant="outline">Pending review</Badge>
    <Badge variant="ghost">Draft</Badge>
    <Badge variant="link">View audit log</Badge>
  </div>
);

export const WithIcon = () => (
  <div className="gap-2 max-w-md flex flex-wrap items-center">
    <Badge variant="default">
      <CheckCircle2Icon />
      Verified
    </Badge>
    <Badge variant="outline">MFA enabled</Badge>
    <Badge variant="destructive">2 overdue</Badge>
  </div>
);
