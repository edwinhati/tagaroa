import { Skeleton } from "@repo/ui/components/skeleton";

export default function Loading() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-10 w-32" />
    </div>
  );
}
