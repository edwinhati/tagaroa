import { Separator } from "@repo/ui";

export const InList = () => (
  <div className="max-w-xs p-4 rounded-md border">
    <div className="gap-1 flex flex-col">
      <span className="text-sm font-medium">Personal information</span>
      <span className="text-sm text-muted-foreground">Name, title, email</span>
    </div>
    <Separator className="my-4" />
    <div className="gap-1 flex flex-col">
      <span className="text-sm font-medium">Security</span>
      <span className="text-sm text-muted-foreground">
        MFA, sessions, break-glass
      </span>
    </div>
    <Separator className="my-4" />
    <div className="gap-1 flex flex-col">
      <span className="text-sm font-medium">Notifications</span>
      <span className="text-sm text-muted-foreground">
        Email and in-app alerts
      </span>
    </div>
  </div>
);

export const InToolbar = () => (
  <div className="h-9 gap-3 px-3 flex items-center rounded-md border">
    <span className="text-sm text-muted-foreground">Roles &amp; access</span>
    <Separator orientation="vertical" className="h-4" />
    <span className="text-sm font-medium">Assignments</span>
    <Separator orientation="vertical" className="h-4" />
    <span className="text-sm text-muted-foreground">Emergency access</span>
  </div>
);
