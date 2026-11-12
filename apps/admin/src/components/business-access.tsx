import { AppTrail, Page } from "@repo/shell/app-shell";
import { NativeSelect } from "@repo/ui/components/native-select";
import { Link } from "@tanstack/react-router";
import { type ReactNode } from "react";

/** The frame both business access pages share: the header, and the switch between them. */
export function BusinessAccessPage({
  actions,
  children,
}: {
  actions: ReactNode;
  children: ReactNode;
}) {
  return (
    <Page
      actions={<div className="gap-2 flex">{actions}</div>}
      breadcrumb={
        <AppTrail
          items={[
            { label: "Identity & access", to: "/identity-access" },
            { label: "Business access" },
          ]}
        />
      }
      description="Explicit permissions inside a subsidiary or team. Titles never grant access."
      title="Business access"
    >
      <nav aria-label="Business access views" className="mb-1">
        <div className="gap-1 flex">
          <Link
            className="px-2.5 py-1.5 aria-[current=page]:font-medium rounded-md text-[13px] text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground"
            to="/identity-access/business-access/assignments"
          >
            Assignments
          </Link>
          <Link
            className="px-2.5 py-1.5 aria-[current=page]:font-medium rounded-md text-[13px] text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground"
            to="/identity-access/business-access/roles"
          >
            Roles
          </Link>
        </div>
      </nav>
      {children}
    </Page>
  );
}

export function FieldSelect({
  label,
  value,
  onChange,
  children,
}: {
  children: ReactNode;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="gap-2 text-sm font-medium grid">
      {label}
      <NativeSelect
        className="w-full"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </NativeSelect>
    </label>
  );
}
