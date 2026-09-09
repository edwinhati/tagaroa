import { Label, Textarea } from "@repo/ui";

export const WithLabel = () => (
  <div className="w-80 gap-1.5 grid">
    <Label htmlFor="justification">Emergency access justification</Label>
    <Textarea
      id="justification"
      defaultValue="Kessler Logistics sync is failing and needs domain:administer to re-run the migration before the 09:00 cutover."
    />
  </div>
);

export const Empty = () => (
  <div className="w-80">
    <Textarea placeholder="Add a note for the audit log…" />
  </div>
);

export const Disabled = () => (
  <div className="w-80">
    <Textarea
      disabled
      defaultValue="Suspension reason: repeated failed MFA challenges."
    />
  </div>
);

export const Invalid = () => (
  <div className="w-80 gap-1.5 grid">
    <Label htmlFor="reason-invalid">Reason</Label>
    <Textarea
      id="reason-invalid"
      aria-invalid
      defaultValue=""
      placeholder="Required before submitting"
    />
    <p className="text-xs text-destructive">
      A reason is required for break-glass access.
    </p>
  </div>
);
