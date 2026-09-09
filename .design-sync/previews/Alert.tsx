import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
  Button,
} from "@repo/ui";
import { AlertTriangleIcon, InfoIcon } from "lucide-react";

export const Variants = () => (
  <div className="gap-3 max-w-md flex flex-col">
    <Alert>
      <InfoIcon />
      <AlertTitle>Directory sync scheduled</AlertTitle>
      <AlertDescription>
        The next Workday import runs tonight at 02:00 UTC. New hires appear in
        the directory automatically.
      </AlertDescription>
    </Alert>
    <Alert variant="destructive">
      <AlertTriangleIcon />
      <AlertTitle>Emergency access still active</AlertTitle>
      <AlertDescription>
        Chidi Balogun's break-glass elevation expires in 4 minutes and will be
        revoked automatically.
      </AlertDescription>
    </Alert>
  </div>
);

export const WithAction = () => (
  <Alert className="max-w-md">
    <AlertTriangleIcon />
    <AlertTitle>MFA required for this role</AlertTitle>
    <AlertDescription>
      Domain administrator can't be granted until two-factor authentication is
      enabled on the account.
    </AlertDescription>
    <AlertAction>
      <Button size="sm" variant="outline">
        Remind
      </Button>
    </AlertAction>
  </Alert>
);
