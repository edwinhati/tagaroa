import { Checkbox, Input, Label } from "@repo/ui";

export const WithInput = () => (
  <div className="w-72 gap-1.5 grid">
    <Label htmlFor="display-name">Display name</Label>
    <Input id="display-name" defaultValue="Ada Okonkwo" />
    <p className="text-xs text-muted-foreground">
      Shown in the directory and on audit log entries.
    </p>
  </div>
);

export const Required = () => (
  <div className="w-72 gap-1.5 grid">
    <Label htmlFor="subsidiary">
      Subsidiary <span className="text-destructive">*</span>
    </Label>
    <Input id="subsidiary" placeholder="e.g. Kessler Logistics BV" />
  </div>
);

export const WithCheckbox = () => (
  <Label className="group/field-label w-72 gap-2 p-3 flex items-start rounded-md border">
    <Checkbox className="mt-0.5" defaultChecked />
    <span className="gap-0.5 flex flex-col">
      <span className="text-sm font-medium">Require MFA for this role</span>
      <span className="text-xs font-normal text-muted-foreground">
        Applies to every person assigned Domain administrator.
      </span>
    </span>
  </Label>
);

export const Disabled = () => (
  <div className="group w-72 gap-1.5 grid" data-disabled="true">
    <Label htmlFor="team-slug">Team slug</Label>
    <Input id="team-slug" disabled defaultValue="supply-chain" />
  </div>
);
