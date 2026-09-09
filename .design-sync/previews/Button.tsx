import { Button } from "@repo/ui";

export const Variants = () => (
  <div className="gap-2 flex flex-wrap items-center">
    <Button>Save changes</Button>
    <Button variant="secondary">Cancel</Button>
    <Button variant="outline">Export CSV</Button>
    <Button variant="ghost">Dismiss</Button>
    <Button variant="destructive">Suspend account</Button>
    <Button variant="link">View audit log</Button>
  </div>
);

export const Sizes = () => (
  <div className="gap-2 flex flex-wrap items-center">
    <Button size="xs">Extra small</Button>
    <Button size="sm">Small</Button>
    <Button size="default">Default</Button>
    <Button size="lg">Large</Button>
  </div>
);

export const Disabled = () => (
  <div className="gap-2 flex flex-wrap items-center">
    <Button disabled>Save changes</Button>
    <Button variant="outline" disabled>
      Export CSV
    </Button>
  </div>
);
