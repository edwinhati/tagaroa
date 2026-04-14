"use client";

import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import * as Sentry from "@sentry/nextjs";
import { useCallback, useEffect, useState } from "react";

interface LogEntry {
  id: string;
  type: "info" | "success" | "error" | "warning";
  message: string;
  timestamp: Date;
  eventId?: string;
}

export function SentryTestConsole() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [lastEventId, setLastEventId] = useState<string | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);

  const addLog = useCallback(
    (type: LogEntry["type"], message: string, eventId?: string) => {
      setLogs((prev) => [
        {
          id: crypto.randomUUID(),
          type,
          message,
          timestamp: new Date(),
          eventId,
        },
        ...prev.slice(0, 49),
      ]);
    },
    [],
  );

  const checkConnection = useCallback(() => {
    const client = Sentry.getClient();
    const initialized = Sentry.isInitialized();
    setIsConnected(initialized && client !== null);
    addLog(
      "info",
      `SDK Status: ${initialized ? "Initialized" : "Not Initialized"} | Client: ${
        client ? "Active" : "Inactive"
      }`,
    );
  }, [addLog]);

  useEffect(() => {
    checkConnection();
    addLog("info", `Environment: ${process.env.NODE_ENV}`);
    addLog(
      "info",
      `DSN: ${process.env.NEXT_PUBLIC_SENTRY_DSN ? "Configured" : "Missing"}`,
    );
  }, [checkConnection, addLog]);

  const triggerError = async () => {
    setIsTriggering(true);
    try {
      const error = new Error(
        "Test error from Sentry test page - button click",
      );
      const eventId = Sentry.captureException(error);
      setLastEventId(eventId ?? null);
      addLog("success", `Exception captured`, eventId ?? undefined);
      addLog("info", `Event ID: ${eventId}`);
    } catch {
      addLog("error", "Failed to capture exception");
    } finally {
      setIsTriggering(false);
    }
  };

  const triggerCrash = () => {
    throw new Error("Test error from Sentry test page - crash");
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const getLogIcon = (type: LogEntry["type"]) => {
    switch (type) {
      case "success":
        return "✓";
      case "error":
        return "✕";
      case "warning":
        return "⚠";
      default:
        return "ℹ";
    }
  };

  const getLogColor = (type: LogEntry["type"]) => {
    switch (type) {
      case "success":
        return "text-green-400";
      case "error":
        return "text-red-400";
      case "warning":
        return "text-yellow-400";
      default:
        return "text-blue-400";
    }
  };

  let connectionStatusText = "Disconnected";
  if (isConnected === null) {
    connectionStatusText = "Checking...";
  } else if (isConnected) {
    connectionStatusText = "Connected";
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="mx-auto max-w-4xl p-8">
        <header className="mb-8">
          <div className="mb-2 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600">
              <span className="text-lg font-bold">S</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Sentry Test Console
              </h1>
              <p className="text-sm text-zinc-500">
                Monitor error capture and SDK events in real-time
              </p>
            </div>
          </div>
        </header>

        <div className="mb-6 grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-500">
              SDK Status
            </div>
            <div
              className={`text-lg font-semibold ${
                isConnected ? "text-green-400" : "text-red-400"
              }`}
            >
              {connectionStatusText}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-500">
              Last Event
            </div>
            <div className="truncate font-mono text-sm text-zinc-300">
              {lastEventId ?? "No events yet"}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-500">
              Events Logged
            </div>
            <div className="text-lg font-semibold text-zinc-300">
              {logs.filter((l) => l.type !== "info").length}
            </div>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-3">
          <Button
            onClick={triggerError}
            disabled={isTriggering}
            className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500"
          >
            <span className="mr-2">◎</span>
            {"Capture Exception"}
          </Button>

          <Button
            onClick={triggerCrash}
            variant="destructive"
            className="bg-red-600 hover:bg-red-500"
          >
            <span className="mr-2">✕</span>
            {"Throw Uncaught Error"}
          </Button>

          <Button
            onClick={checkConnection}
            variant="outline"
            className="border-zinc-700 bg-transparent hover:bg-zinc-800"
          >
            <span className="mr-2">↻</span>
            {"Check Status"}
          </Button>

          <Button
            onClick={clearLogs}
            variant="ghost"
            className="text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            Clear Logs
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  className="border-zinc-700 bg-transparent hover:bg-zinc-800"
                >
                  <span className="mr-2">📋</span>
                  {"Copy Logs"}
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() => {
                  const logText = logs
                    .map((l) => {
                      const baseLog = `[${l.timestamp.toISOString()}] [${l.type.toUpperCase()}] ${l.message}`;
                      return l.eventId
                        ? `${baseLog} (ID: ${l.eventId})`
                        : baseLog;
                    })
                    .join("\n");
                  navigator.clipboard.writeText(logText);
                  addLog("info", "Copied as text");
                }}
              >
                Copy as Text
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  const jsonLog = JSON.stringify(logs, null, 2);
                  navigator.clipboard.writeText(jsonLog);
                  addLog("info", "Copied as JSON");
                }}
              >
                Copy as JSON
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  const eventIds = logs
                    .filter((l) => l.eventId)
                    .map((l) => l.eventId)
                    .join("\n");
                  navigator.clipboard.writeText(eventIds);
                  addLog("info", "Copied event IDs");
                }}
              >
                Copy Event IDs Only
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80">
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
            <h2 className="text-sm font-medium text-zinc-300">Event Log</h2>
            <span className="text-xs text-zinc-600">{logs.length} entries</span>
          </div>

          <div className="h-80 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="flex h-full items-center justify-center text-zinc-600">
                No events logged yet. Trigger an action above.
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/50">
                {logs.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-zinc-800/30"
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded text-xs ${getLogColor(entry.type)}`}
                    >
                      {getLogIcon(entry.type)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="font-mono text-sm text-zinc-200">
                          {entry.message}
                        </span>
                        <span className="text-xs text-zinc-600">
                          {entry.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      {entry.eventId && (
                        <div className="mt-1 font-mono text-xs text-zinc-500">
                          ID: {entry.eventId}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <footer className="mt-8 border-t border-zinc-800 pt-6 text-center text-xs text-zinc-600">
          <p>
            Events are sent to Sentry via{" "}
            <code className="text-zinc-500">
              {process.env.NEXT_PUBLIC_SENTRY_DSN
                ? "configured DSN"
                : "missing DSN"}
            </code>
          </p>
        </footer>
      </div>
    </div>
  );
}
