import { Button, Spinner } from "@repo/ui";

export const InButton = () => (
  <div className="gap-2 flex items-center">
    <Button disabled>
      <Spinner />
      Saving changes
    </Button>
    <Button variant="outline" disabled>
      <Spinner className="size-3.5" />
      Exporting
    </Button>
  </div>
);

export const PageLoading = () => (
  <div className="max-w-sm gap-2 p-10 flex flex-col items-center justify-center rounded-md border text-center">
    <Spinner className="size-6 text-muted-foreground" />
    <span className="text-sm text-muted-foreground">Loading directory…</span>
  </div>
);
