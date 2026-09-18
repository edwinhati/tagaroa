import { Badge } from "@repo/ui";
import { CheckCircle2Icon } from "lucide-react";

export const Status = () => (
  <div className="gap-2 max-w-md flex flex-wrap items-center">
    <Badge data-status="success" variant="outline">
      Active
    </Badge>
    <Badge data-status="info" variant="outline">
      Invited
    </Badge>
    <Badge data-status="warning" variant="outline">
      MFA stale
    </Badge>
    <Badge data-status="danger" variant="outline">
      Suspended
    </Badge>
    <Badge data-status="neutral" variant="outline">
      Revoked
    </Badge>
  </div>
);

export const Variants = () => (
  <div className="gap-2 max-w-md flex flex-wrap items-center">
    <Badge variant="default">3 pending</Badge>
    <Badge variant="secondary">Platform</Badge>
    <Badge variant="outline">Member</Badge>
    <Badge variant="ghost">Draft</Badge>
    <Badge variant="link">View audit log</Badge>
  </div>
);

export const WithIcon = () => (
  <div className="gap-2 max-w-md flex flex-wrap items-center">
    <Badge data-status="success" variant="outline">
      <CheckCircle2Icon />
      Verified
    </Badge>
    <Badge data-status="danger" variant="outline">
      2 overdue
    </Badge>
  </div>
);
