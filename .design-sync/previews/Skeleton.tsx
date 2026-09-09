import { Skeleton } from "@repo/ui";

export const LoadingList = () => (
  <div className="max-w-sm gap-3 flex flex-col">
    {[0, 1, 2].map((row) => (
      <div className="gap-3 flex items-center" key={row}>
        <Skeleton className="size-9 rounded-full" />
        <div className="gap-2 flex flex-1 flex-col">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-2.5 w-64" />
        </div>
      </div>
    ))}
  </div>
);

export const LoadingCard = () => (
  <div className="max-w-sm gap-2 p-4 flex flex-col rounded-md border border-border">
    <Skeleton className="h-4 w-24" />
    <Skeleton className="h-2.5 w-full" />
    <Skeleton className="h-2.5 w-full" />
  </div>
);
