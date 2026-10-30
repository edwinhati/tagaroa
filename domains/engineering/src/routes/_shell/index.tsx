import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_shell/")({
  component: EngineeringHome,
});

/**
 * The domain's front end exists; the work inside it does not yet. The sentence
 * says which, so nobody reads an empty page as a broken one.
 */
function EngineeringHome() {
  return (
    <div className="max-w-[36rem]">
      <h1 className="text-lg font-semibold leading-[1.2] tracking-[-0.02em] text-pretty">
        Engineering
      </h1>
      <div className="mt-6 p-5 overflow-hidden rounded-[var(--panel-radius)] border border-border bg-card shadow-[var(--panel-shadow)]">
        <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
          This domain has its own front end now, and nothing in it yet.
        </p>
      </div>
    </div>
  );
}
