import {
  AccountSecurityPanel,
  SettingsGroup,
  SettingsLoading,
  SettingsRetry,
} from "@repo/shell/account-security";
import { authCall } from "@repo/shell/attempt-auth";
import { authClient } from "@repo/shell/auth-client";
import { sessionQueryOptions } from "@repo/shell/session";
import { parseUserAgent } from "@repo/shell/session-device";
import { SessionDeviceMarks } from "@repo/shell/session-device-mark";
import { CORE_URL } from "@repo/shell/urls";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { relativeTime } from "@repo/ui/lib/relative-time";
import { cn } from "@repo/ui/lib/utils";
import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useRef, useState, type ReactNode } from "react";

type Section = "profile" | "security" | "sessions";

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

const SECTIONS = [
  ["profile", "Profile"],
  ["security", "Security"],
  ["sessions", "Sessions"],
] as const satisfies ReadonlyArray<readonly [Section, string]>;

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts.at(-1)![0] ?? ""}`.toUpperCase();
}

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
              maxLength={80}
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

async function readSessions() {
  const [listed, current] = await Promise.all([
    authCall(
      () => authClient.listSessions(),
      "Could not read your active sessions.",
    ),
    authClient.getSession(),
  ]);
  return {
    currentToken: current.data?.session.token ?? null,
    sessions: listed ?? [],
  };
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

export function AccountSettingsDialog({
  email,
  name,
  open,
  onOpenChange,
  twoFactorEnabled,
}: {
  email: string;
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  twoFactorEnabled: boolean;
}) {
  const [section, setSection] = useState<Section>("profile");
  const [mfaEnabled, setMfaEnabled] = useState(twoFactorEnabled);

  const [previousMfaEnabled, setPreviousMfaEnabled] =
    useState(twoFactorEnabled);
  const [previousOpen, setPreviousOpen] = useState(open);
  if (previousMfaEnabled !== twoFactorEnabled) {
    setPreviousMfaEnabled(twoFactorEnabled);
    setMfaEnabled(twoFactorEnabled);
  }
  if (previousOpen !== open) {
    setPreviousOpen(open);
    if (open) setSection("profile");
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="gap-0 p-0 sm:max-w-md overflow-hidden overscroll-contain"
        data-account-settings=""
        showCloseButton
      >
        <Tabs
          className="flex flex-col"
          onValueChange={(value) => setSection(value as Section)}
          value={section}
        >
          <DialogHeader className="gap-4 px-5 pt-5 pb-0 pr-12 text-left">
            <div className="gap-3.5 flex items-center">
              <Avatar size="lg">
                <AvatarFallback>{initialsFromName(name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 gap-0.5 flex flex-col">
                <DialogTitle className="text-base font-medium leading-snug tracking-[-0.02em] text-balance">
                  {name}
                </DialogTitle>
                <DialogDescription className="text-[0.8125rem] break-all">
                  {email}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <TabsList
            aria-label="Account sections"
            className="h-auto w-full justify-stretch"
            variant="line"
          >
            {SECTIONS.map(([id, label]) => (
              <TabsTrigger
                className="h-10 flex-1 touch-manipulation"
                key={id}
                value={id}
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="px-5 pt-4 pb-5 max-h-[min(28rem,70dvh)] overflow-y-auto overscroll-contain">
            {section === "profile" ? (
              <ProfileSection
                mfaEnabled={mfaEnabled}
                name={name}
                onManageSignIn={() => setSection("security")}
              />
            ) : null}
            {section === "security" ? (
              <div className="outline-none" role="tabpanel">
                <AccountSecurityPanel
                  onTwoFactorChange={setMfaEnabled}
                  twoFactorEnabled={mfaEnabled}
                />
              </div>
            ) : null}
            {section === "sessions" ? <SessionsSection /> : null}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function ProfileSection({
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

const SESSIONS_QUERY_KEY = ["account", "sessions"];

function SessionsSection() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const sessions = useQuery({
    queryKey: SESSIONS_QUERY_KEY,
    queryFn: readSessions,
  });

  /** Ending sessions reports in one line under the list, either way. */
  const report = (done: string) => ({
    onMutate: () => setMessage(""),
    onError: (error: Error) => setMessage(error.message),
    onSuccess: () => {
      setMessage(done);
      void queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY });
    },
  });
  const revokeOne = useMutation({
    mutationFn: (token: string) =>
      authCall(
        () => authClient.revokeSession({ token }),
        "That session was not ended.",
      ),
    ...report("Session ended."),
  });
  const revokeOthers = useMutation({
    mutationFn: () =>
      authCall(
        () => authClient.revokeOtherSessions(),
        "Other sessions were not ended.",
      ),
    ...report("Other sessions ended."),
  });

  if (sessions.isPending) {
    return (
      <div className="gap-3 flex flex-col outline-none" role="tabpanel">
        <SettingsLoading label="Loading sessions…">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </SettingsLoading>
      </div>
    );
  }
  if (sessions.isError) {
    return (
      <div className="gap-3 flex flex-col outline-none" role="tabpanel">
        <SettingsRetry
          error={sessions.error}
          onRetry={() => void sessions.refetch()}
        />
      </div>
    );
  }

  const { currentToken } = sessions.data;
  const otherSessions = sessions.data.sessions.filter(
    (session) => session.token !== currentToken,
  ).length;

  return (
    <div className="gap-3 flex flex-col outline-none" role="tabpanel">
      {sessions.data.sessions.length === 0 ? (
        <SettingsGroup>
          <div className="gap-3 p-3.5 flex flex-col">
            <p className="text-[0.8125rem] text-muted-foreground" role="status">
              No sessions to show.
            </p>
            <Button
              className="self-start"
              onClick={() => void sessions.refetch()}
              size="sm"
              type="button"
              variant="outline"
            >
              Reload
            </Button>
          </div>
        </SettingsGroup>
      ) : (
        <>
          <SettingsGroup>
            <ul>
              {sessions.data.sessions.map((session) => {
                const parsed = parseUserAgent(session.userAgent);
                const current = session.token === currentToken;
                const ip = session.ipAddress?.trim();

                return (
                  <li
                    className="gap-3 px-3.5 py-3 flex items-center justify-between border-b border-border/70 last:border-b-0"
                    key={session.id}
                  >
                    <div className="min-w-0 gap-2.5 flex items-start">
                      <SessionDeviceMarks
                        browser={parsed.browser}
                        platform={parsed.platform}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-snug">
                          {parsed.label}
                          {current ? (
                            <span className="font-normal text-muted-foreground">
                              {" "}
                              · this device
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-[0.8125rem] text-muted-foreground tabular-nums">
                          {ip ? `${ip} · ` : ""}
                          {relativeTime(session.updatedAt)}
                        </p>
                      </div>
                    </div>
                    {current ? null : (
                      <Button
                        className="shrink-0"
                        disabled={revokeOne.isPending}
                        onClick={() => revokeOne.mutate(session.token)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        End
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </SettingsGroup>

          {message ? (
            <p
              aria-live="polite"
              className="px-0.5 text-[0.8125rem] text-muted-foreground"
              role="status"
            >
              {message}
            </p>
          ) : null}

          {otherSessions > 0 ? (
            <Button
              className="self-start"
              disabled={revokeOthers.isPending}
              onClick={() => revokeOthers.mutate()}
              size="sm"
              type="button"
              variant="outline"
            >
              {revokeOthers.isPending ? "Ending…" : "End other sessions"}
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
