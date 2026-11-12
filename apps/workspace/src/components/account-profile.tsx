import { DISPLAY_NAME_MAX_LENGTH } from "@repo/contracts/identity";
import {
  SettingsGroup,
  SettingsLoading,
  SettingsRetry,
} from "@repo/shell/account-security";
import { authCall } from "@repo/shell/attempt-auth";
import { authClient } from "@repo/shell/auth-client";
import { sessionQueryOptions } from "@repo/shell/session";
import { CORE_URL } from "@repo/shell/urls";
import { Button } from "@repo/ui/components/button";
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useRef, useState, type ReactNode } from "react";

type MyPosition = {
  id: string;
  managerName: string | null;
  subsidiaryName: string | null;
  title: string;
};

type MySubsidiary = {
  id: string;
  name: string;
};

type MyTeam = {
  id: string;
  name: string;
  subsidiaryName: string;
};

function SettingsRow({
  label,
  children,
  action,
}: {
  label: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "gap-x-3 gap-y-1 px-3.5 py-3 items-start border-b border-border/70 last:border-b-0",
        action
          ? "grid grid-cols-[minmax(5rem,6.75rem)_minmax(0,1fr)_auto]"
          : "grid grid-cols-[minmax(5rem,6.75rem)_minmax(0,1fr)]",
      )}
    >
      <dt className="pt-0.5 leading-5 text-[0.8125rem] text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 text-sm leading-5 text-pretty text-foreground">
        {children}
      </dd>
      {action ? (
        <div className="-my-1 shrink-0 self-center justify-self-end">
          {action}
        </div>
      ) : null}
    </div>
  );
}

const NAME_NOT_SAVED =
  "Your name was not saved. Check your connection and try again.";

/**
 * The one profile field a person may change. The server holds the rules
 * (`updateProfileBody`), so its sentence is the error shown here.
 */
function DisplayNameRow({ name }: { name: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const editButton = useRef<HTMLButtonElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [saved, setSaved] = useState("");

  const mutationKey = ["account", "display-name"];
  const isSaving = useIsMutating({ mutationKey }) > 0;
  const save = useMutation({
    mutationKey,
    mutationFn: async (value: string) => {
      await authCall(
        () => authClient.updateUser({ name: value.trim() }),
        NAME_NOT_SAVED,
      );
      await queryClient.refetchQueries({
        queryKey: sessionQueryOptions.queryKey,
      });
      await router.invalidate();
    },
    onMutate: () => setSaved(""),
    onSuccess: () => {
      setEditing(false);
      setSaved("Name saved.");
      requestAnimationFrame(() => editButton.current?.focus());
    },
  });

  const close = () => {
    if (isSaving) return;
    setEditing(false);
    save.reset();
    requestAnimationFrame(() => editButton.current?.focus());
  };

  const error = save.error?.message ?? "";

  return (
    <>
      {editing ? (
        <form
          className="gap-3 p-3.5 flex flex-col"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (!isSaving) save.mutate(draft);
          }}
        >
          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor="account-display-name">Name</FieldLabel>
            <Input
              aria-describedby={
                error ? "account-display-name-error" : undefined
              }
              aria-invalid={Boolean(error)}
              autoComplete="name"
              autoFocus
              id="account-display-name"
              maxLength={DISPLAY_NAME_MAX_LENGTH}
              name="name"
              onChange={(event) => setDraft(event.target.value)}
              required
              value={draft}
            />
            {error ? (
              <FieldError id="account-display-name-error">{error}</FieldError>
            ) : null}
          </Field>
          <div className="gap-2 flex">
            <Button disabled={isSaving} size="sm" type="submit">
              {save.isPending ? "Saving…" : "Save"}
            </Button>
            <Button
              disabled={isSaving}
              onClick={close}
              size="sm"
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <dl>
          <SettingsRow
            action={
              <Button
                aria-label="Edit name"
                disabled={isSaving}
                onClick={() => {
                  setDraft(name);
                  setSaved("");
                  setEditing(true);
                }}
                ref={editButton}
                size="sm"
                type="button"
                variant="ghost"
              >
                Edit
              </Button>
            }
            label="Name"
          >
            {name}
          </SettingsRow>
        </dl>
      )}
      {/* Stays mounted across edit and read so the confirmation is announced. */}
      <p
        aria-live="polite"
        className={cn(
          "text-[0.8125rem] text-muted-foreground",
          saved && "px-3.5 pb-3",
        )}
        role="status"
      >
        {saved}
      </p>
    </>
  );
}

async function readMyDirectory(): Promise<{
  positions: MyPosition[];
  subsidiaries: MySubsidiary[];
  teams: MyTeam[];
}> {
  const response = await fetch(`${CORE_URL}/api/directory/me`, {
    signal: AbortSignal.timeout(20_000),
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Could not read your place in the group.");
  }
  const body = (await response.json()) as {
    data: {
      positions: MyPosition[];
      subsidiaries: MySubsidiary[];
      teams: MyTeam[];
    };
  };
  return body.data;
}

export function ProfileSection({
  mfaEnabled,
  name,
  onManageSignIn,
}: {
  mfaEnabled: boolean;
  name: string;
  onManageSignIn: () => void;
}) {
  const profile = useQuery({
    queryKey: ["account", "profile"],
    queryFn: readMyDirectory,
  });

  return (
    <div className="gap-3 flex flex-col outline-none" role="tabpanel">
      <SettingsGroup>
        <DisplayNameRow name={name} />
      </SettingsGroup>
      {profile.isPending ? (
        <SettingsLoading label="Loading profile details…">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-3/5" />
        </SettingsLoading>
      ) : profile.isError ? (
        <SettingsRetry
          error={profile.error}
          onRetry={() => void profile.refetch()}
        />
      ) : (
        <dl>
          <SettingsGroup>
            <SettingsRow
              action={
                <button
                  className={cn(
                    "font-medium text-[0.8125rem] text-foreground",
                    "min-h-10 px-1.5 -mx-1.5 rounded-md",
                    "inline-flex items-center",
                    "hover:bg-foreground/5",
                    "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                  )}
                  onClick={onManageSignIn}
                  type="button"
                >
                  Manage
                </button>
              }
              label="Sign-in"
            >
              {mfaEnabled ? "Authenticator ready" : "Authenticator needed"}
            </SettingsRow>
            {profile.data.positions.map((position) => (
              <SettingsRow key={position.id} label="Title">
                <span className="gap-0.5 flex flex-col">
                  <span>{position.title}</span>
                  <span className="text-[0.8125rem] text-muted-foreground">
                    {position.subsidiaryName ?? "Group"}
                    {position.managerName
                      ? ` · reports to ${position.managerName}`
                      : ""}
                  </span>
                </span>
              </SettingsRow>
            ))}
            {profile.data.subsidiaries.map((subsidiary) => (
              <SettingsRow key={subsidiary.id} label="Subsidiary">
                {subsidiary.name}
              </SettingsRow>
            ))}
            {profile.data.teams.map((team) => (
              <SettingsRow key={team.id} label="Team">
                {team.name}
                <span className="text-muted-foreground">
                  {" "}
                  · {team.subsidiaryName}
                </span>
              </SettingsRow>
            ))}
          </SettingsGroup>
        </dl>
      )}
    </div>
  );
}
