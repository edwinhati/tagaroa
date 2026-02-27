import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
      <h2 className="text-2xl font-semibold">404 — Not Found</h2>
      <p className="text-muted-foreground text-sm">
        The page you are looking for does not exist.
      </p>
      <Link
        href="/"
        className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
