import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Logo } from "@repo/ui/components/logo";
import { cn } from "@repo/ui/lib/utils";
import type { ComponentProps, ReactNode } from "react";

import { ThemeToggle, useTheme } from "./theme";
import { Tide } from "./tide";

export function AuthShell({ children }: { children: ReactNode }) {
  const { theme } = useTheme();

  return (
    <div className="grid min-h-svh grid-rows-[auto_1fr]">
      <header className="px-5 py-4 lg:px-7 lg:py-5 flex items-center justify-between">
        <Logo size={18} />
        <ThemeToggle />
      </header>

      <div className="gap-6 px-5 pb-5 lg:grid-cols-2 lg:gap-8 lg:px-7 lg:pb-7 grid">
        <main className="py-8 lg:py-4 flex items-center justify-center">
          <div className="w-full max-w-[21rem]">{children}</div>
        </main>

        {/* Inset, not flush: the water is an object on the page, not the page. */}
        <aside className="lg:block relative hidden rounded-2xl border border-border">
          <Tide calm={-0.35} theme={theme} />
        </aside>
      </div>
    </div>
  );
}

export function ScreenHeading({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-6 text-center">
      <h1 className="font-medium text-[clamp(1.5rem,2.4vw,1.95rem)] leading-[1.12] tracking-[-0.03em] text-balance">
        {title}
      </h1>
      {children ? (
        <p className="mt-2.5 leading-relaxed mx-auto text-[0.875rem] text-balance text-muted-foreground">
          {children}
        </p>
      ) : null}
    </header>
  );
}

export function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="p-5 rounded-2xl border border-border bg-card/60">
      {children}
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  id,
  className,
  ...props
}: ComponentProps<"input"> & {
  label: string;
  hint?: ReactNode;
  error?: string;
  id: string;
}) {
  return (
    <div className="gap-1.5 grid">
      <div className="gap-3 flex items-baseline justify-between">
        <label htmlFor={id} className="font-medium text-[0.8125rem]">
          {label}
        </label>
        {hint ? (
          <span className="text-[0.78rem] text-muted-foreground">{hint}</span>
        ) : null}
      </div>

      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          "h-10 px-3 sm:h-9 rounded-md bg-input/25 text-[0.875rem]",
          className,
        )}
        {...props}
      />

      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="rise-in text-[0.775rem] text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Submit({
  pending,
  children,
  pendingLabel,
}: {
  pending: boolean;
  children: ReactNode;
  pendingLabel: string;
}) {
  return (
    <Button
      type="submit"
      disabled={pending}
      className="mt-1 h-10 sm:h-9 w-full rounded-md text-[0.875rem]"
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}

/** Form-level failure: names the problem, then the recovery. */
export function FormError({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rise-in py-0.5 pl-2.5 leading-relaxed border-l border-destructive text-[0.8125rem] text-destructive"
    >
      {children}
    </p>
  );
}

export function Aside({ children }: { children: ReactNode }) {
  return (
    <p className="mt-6 leading-relaxed text-center text-[0.8125rem] text-muted-foreground">
      {children}
    </p>
  );
}
