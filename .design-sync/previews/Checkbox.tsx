import { Checkbox } from "@repo/ui";

export const States = () => (
  <div className="gap-6 flex flex-wrap items-center">
    <label className="gap-2 text-sm flex items-center text-foreground">
      <Checkbox aria-label="Unchecked" />
      Unchecked
    </label>
    <label className="gap-2 text-sm flex items-center text-foreground">
      <Checkbox aria-label="Checked" defaultChecked />
      Checked
    </label>
    <label className="gap-2 text-sm flex items-center text-foreground">
      <Checkbox aria-label="Indeterminate" indeterminate />
      Indeterminate
    </label>
    <label className="gap-2 text-sm flex items-center text-foreground opacity-50">
      <Checkbox aria-label="Disabled" disabled />
      Disabled
    </label>
    <label className="gap-2 text-sm flex items-center text-foreground opacity-50">
      <Checkbox aria-label="Disabled checked" defaultChecked disabled />
      Disabled + checked
    </label>
  </div>
);

export const Invalid = () => (
  <label className="gap-2 text-sm flex items-center text-destructive">
    <Checkbox aria-invalid aria-label="Accept the access policy" />
    You must accept the access policy
  </label>
);
