import { Logo } from "@repo/ui/blocks/logo";
import { PasswordInput } from "@repo/ui/blocks/password-input";
import { ThemeToggle } from "@repo/ui/blocks/theme";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import {
  Field as FieldPrimitive,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Spinner } from "@repo/ui/components/spinner";
import { cn } from "@repo/ui/lib/utils";
import { useEffect, useRef, type ComponentProps, type ReactNode } from "react";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-svh grid-rows-[auto_1fr]">
      <header className="px-5 py-4 lg:px-7 lg:py-5 flex items-center justify-between">
        <Logo size={22} />
        <ThemeToggle />
      </header>

      {/* Cap the two-pane band so ultrawide screens do not strand a 21rem form
          in an enormous empty left column. */}
      <div className="gap-6 px-5 pb-5 lg:grid-cols-2 lg:gap-8 lg:px-7 lg:pb-7 mx-auto grid w-full max-w-[96rem]">
        <main className="py-8 lg:py-4 flex items-center justify-center">
          {/* rise-in: first paint and every AuthShell remount (sign-in → 2FA,
              choose-password, …) share the same 180ms entry. Route Link
              navigations still use the view-transition crossfade. */}
          <div className="rise-in w-full max-w-[21rem]">{children}</div>
        </main>

        {/* Decorative tide panel. It is hidden below lg and omitted from the
            accessibility tree because it carries no content. */}
        <div
          aria-hidden="true"
          className="tide lg:block relative hidden min-h-[28rem] rounded-[1rem] border border-border"
        />
      </div>
    </div>
  );
}

export function ScreenHeading({
  title,
  children,
  focusOnMount = false,
}: {
  title: string;
  children?: ReactNode;
  focusOnMount?: boolean;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (focusOnMount) headingRef.current?.focus();
  }, [focusOnMount]);

  return (
    <header className="mb-4 text-center">
      <h1
        className="font-medium text-[clamp(1.5rem,2.4vw,1.95rem)] leading-[1.12] tracking-[-0.03em] text-balance outline-none"
        ref={headingRef}
        tabIndex={focusOnMount ? -1 : undefined}
      >
        {title}
      </h1>

      {children ? (
        <p className="mt-1.5 leading-relaxed mx-auto text-[13px] text-pretty text-muted-foreground">
          {children}
        </p>
      ) : null}
    </header>
  );
}

export function Panel({
  action,
  children,
  description,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  title?: ReactNode;
}) {
  // Door register: flat bordered inset at 1rem. Do not use Card (product lift).
  // Use explicit 1rem — theme remaps rounded-2xl to panel radius (12px).
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[1rem] border border-border bg-card/60 text-card-foreground shadow-none",
        title ? "gap-4 flex flex-col" : null,
      )}
    >
      {title ? (
        <div className="gap-1 px-4 pt-4 flex flex-col">
          <div className="gap-2 flex items-start justify-between">
            <div className="min-w-0">
              <h2 className="font-medium text-sm">{title}</h2>
              {description ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {description}
                </p>
              ) : null}
            </div>
            {action}
          </div>
        </div>
      ) : null}
      <div className={cn("px-4 pb-4", title ? "pt-0" : "pt-4")}>{children}</div>
    </div>
  );
}

/**
 * Validation runs on submit, so the first failing field is only known once the
 * submission resolves — which is where the focus goes, rather than leaving a
 * keyboard or screen-reader user at a button that just refused them.
 */
export function AuthForm({
  onSubmit,
  children,
}: {
  onSubmit: () => Promise<unknown>;
  children: ReactNode;
}) {
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        void onSubmit().then(() => {
          form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
        });
      }}
    >
      <FieldGroup className="gap-4">{children}</FieldGroup>
    </form>
  );
}

export function Field({
  label,
  hint,
  error,
  id,
  className,
  type,
  ...props
}: ComponentProps<"input"> & {
  label: string;
  hint?: ReactNode;
  error?: string;
  id: string;
}) {
  const describedBy = error ? `${id}-error` : undefined;

  return (
    <FieldPrimitive className="gap-1.5" data-invalid={error ? true : undefined}>
      <div className="gap-3 flex items-baseline justify-between">
        <FieldLabel htmlFor={id} className="text-xs">
          {label}
        </FieldLabel>
        {hint ? (
          <span className="text-2xs text-muted-foreground">{hint}</span>
        ) : null}
      </div>

      {/* Size and fill come from the shared Input: it already holds 16px text
          below md, which is what stops iOS Safari zooming the page on focus. */}
      {type === "password" ? (
        <PasswordInput
          id={id}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={cn("h-full", className)}
          {...props}
        />
      ) : (
        <Input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={className}
          type={type}
          {...props}
        />
      )}

      {error ? (
        <FieldError id={`${id}-error`} className="rise-in text-2xs">
          {error}
        </FieldError>
      ) : null}
    </FieldPrimitive>
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
      aria-busy={pending || undefined}
      className="mt-1 w-full"
    >
      {/* The label carries the state on its own, so reduced motion — which
          freezes the spinner — loses nothing. */}
      {pending ? (
        <>
          <Spinner aria-hidden="true" data-icon="inline-start" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

/** Form-level failure: names the problem, then the recovery. */
export function FormError({ children }: { children: ReactNode }) {
  return (
    <Alert className="rise-in" variant="destructive">
      <AlertDescription className="text-xs">{children}</AlertDescription>
    </Alert>
  );
}

export function Aside({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 leading-relaxed text-xs text-center text-pretty text-muted-foreground">
      {children}
    </div>
  );
}
