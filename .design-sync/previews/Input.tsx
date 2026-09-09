import { Input, Label } from "@repo/ui";

export const States = () => (
  <div className="max-w-xs gap-4 flex flex-col">
    <div className="gap-1.5 flex flex-col">
      <Label htmlFor="input-name">Full name</Label>
      <Input id="input-name" placeholder="Ada Okonkwo" />
    </div>
    <div className="gap-1.5 flex flex-col">
      <Label htmlFor="input-title">Title</Label>
      <Input id="input-title" defaultValue="Head of supply chain" />
    </div>
    <div className="gap-1.5 flex flex-col">
      <Label htmlFor="input-email">Work email</Label>
      <Input id="input-email" defaultValue="not-an-email" aria-invalid="true" />
      <p className="text-sm text-destructive">
        Enter a valid work email address.
      </p>
    </div>
    <div className="gap-1.5 flex flex-col">
      <Label htmlFor="input-disabled">Employee ID</Label>
      <Input id="input-disabled" defaultValue="TG-04821" disabled />
    </div>
  </div>
);

export const Types = () => (
  <div className="max-w-xs gap-4 flex flex-col">
    <div className="gap-1.5 flex flex-col">
      <Label htmlFor="input-search">Search directory</Label>
      <Input id="input-search" type="search" placeholder="Search people…" />
    </div>
    <div className="gap-1.5 flex flex-col">
      <Label htmlFor="input-password">Temporary password</Label>
      <Input id="input-password" type="password" defaultValue="correct-horse" />
    </div>
    <div className="gap-1.5 flex flex-col">
      <Label htmlFor="input-number">Session timeout (minutes)</Label>
      <Input id="input-number" type="number" defaultValue={15} />
    </div>
  </div>
);
