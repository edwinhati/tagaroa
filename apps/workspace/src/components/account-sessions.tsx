import {
  SettingsGroup,
  SettingsLoading,
  SettingsRetry,
} from "@repo/shell/account-security";
import { authCall } from "@repo/shell/attempt-auth";
import { authClient } from "@repo/shell/auth-client";
import { parseUserAgent } from "@repo/shell/session-device";
import { SessionDeviceMarks } from "@repo/shell/session-device-mark";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { relativeTime } from "@repo/ui/lib/relative-time";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

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

const SESSIONS_QUERY_KEY = ["account", "sessions"];

export function SessionsSection() {
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
