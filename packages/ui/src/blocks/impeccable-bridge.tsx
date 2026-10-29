import type { DevtoolsTool } from "@repo/ui/blocks/internal-devtools";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@repo/ui/components/native-select";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type DragEvent,
} from "react";
import { ThinkingOrb, type OrbState } from "thinking-orbs";

type BridgeState = {
  app: string | null;
  agent: string | null;
  session: string | null;
  resumeCommand: string | null;
  listening?: string[];
  output?: string;
  terminal?: string | null;
  phase: "idle" | "waiting" | "working" | "error" | "stopping";
  event: { id: string | null; type: string } | null;
  error: string | null;
  history: { time: string; message: string }[];
};

type Snapshot = {
  apps: string[];
  repoRoot: string;
  tools?: { tmux: boolean; ttyd: boolean };
  state: BridgeState;
};

const endpoint = `http://localhost:${import.meta.env.VITE_IMPECCABLE_BRIDGE_PORT || "8410"}`;

const agents = [
  { value: "claude", label: "Claude Code" },
  { value: "codex", label: "Codex" },
  { value: "cursor", label: "Cursor" },
  { value: "pi", label: "Pi" },
];

/** What the agent is doing for each Live event, in the words the widget uses. */
const eventStatus: Record<string, string> = {
  generate: "Generating variants",
  steer: "Following your note",
  accept: "Applying the chosen variant",
  discard: "Discarding variants",
  manual_edit_apply: "Applying your edits",
  carbonize_cleanup: "Cleaning up the accepted variant",
  variant_mount_failed: "Fixing a variant that didn't render",
};

const appGroups = [
  { prefix: "apps/", label: "Apps" },
  { prefix: "domains/", label: "Domains" },
];

function useReducedMotion() {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

/**
 * The orb's nine states, matched to the bridge.
 * Offline and reconnecting wire themselves up. A first check scans.
 * Idle rests. A live wait listens. Each Live action uses the motion
 * that matches the work.
 */
function sessionOrb(
  available: boolean,
  phase: BridgeState["phase"] | undefined,
  eventType: string | undefined,
): OrbState {
  if (!available || phase === "error" || phase === "stopping")
    return "connecting";
  if (!phase) return "searching";
  if (phase === "waiting") return "listening";
  if (phase === "working") {
    if (eventType === "generate") return "shaping";
    if (eventType === "steer") return "weaving";
    if (eventType === "accept" || eventType === "carbonize_cleanup")
      return "composing";
    if (
      eventType === "manual_edit_apply" ||
      eventType === "variant_mount_failed"
    )
      return "solving";
    return "working";
  }
  return "breathing";
}

const docsUrl = "https://impeccable.style/docs";

/** The mark from the Impeccable site header. */
function ImpeccableMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M5 2.5 L13.5 2.5 L5.5 21.5 L5 21.5 Q2.5 21.5 2.5 19 L2.5 5 Q2.5 2.5 5 2.5 Z" />
      <path d="M16.5 2.5 L19 2.5 Q21.5 2.5 21.5 5 L21.5 19 Q21.5 21.5 19 21.5 L8.5 21.5 Z" />
    </svg>
  );
}

/** The Impeccable tab for InternalDevtools. `app` is the repo path of the app it runs in. */
export function impeccableBridgeTool(app: string): DevtoolsTool {
  return {
    id: "impeccable-bridge",
    label: "Impeccable",
    icon: <ImpeccableMark />,
    content: <ImpeccableBridge app={app} />,
  };
}

/** Runs Impeccable Live actions with one local agent session. */
export function ImpeccableBridge({ app }: { app: string }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [available, setAvailable] = useState(true);
  const [selectedApp, setSelectedApp] = useState(app);
  const [selectedAgent, setSelectedAgent] = useState("claude");
  const [actionError, setActionError] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);
  const dragDepth = useRef(0);
  const misses = useRef(0);
  const outputRef = useRef<HTMLPreElement>(null);
  const stickToEnd = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`${endpoint}/api/status`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Bridge unavailable");
      setSnapshot((await response.json()) as Snapshot);
      misses.current = 0;
      setAvailable(true);
    } catch {
      // One missed poll is a blip (a standby bridge is taking over), not an outage.
      misses.current += 1;
      if (misses.current >= 2) setAvailable(false);
    }
  }, []);

  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => void refresh(), 400);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [refresh]);

  async function send(path: "connect" | "disconnect") {
    setActionError(null);
    let response: Response;
    try {
      response = await fetch(`${endpoint}/api/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:
          path === "connect"
            ? JSON.stringify({ app: selectedApp, agent: selectedAgent })
            : undefined,
      });
    } catch {
      setActionError("Couldn't reach the bridge.");
      return;
    }
    if (!response.ok) {
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setActionError(result.error || "The bridge turned that request down.");
      return;
    }
    await refresh();
  }

  async function dropFiles(list: FileList | File[]) {
    const files = [...list];
    if (!files.length) return;
    setActionError(null);
    setDropping(false);
    dragDepth.current = 0;
    let response: Response;
    try {
      response = await fetch(`${endpoint}/api/drop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: await Promise.all(
            files.map(async (file) => ({
              name: file.name,
              data: btoa(
                new Uint8Array(await file.arrayBuffer()).reduce(
                  (data, byte) => data + String.fromCharCode(byte),
                  "",
                ),
              ),
            })),
          ),
        }),
      });
    } catch {
      setActionError("Couldn't send the file to the agent.");
      return;
    }
    if (!response.ok) {
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setActionError(result.error || "Couldn't send the file to the agent.");
    }
    await refresh();
  }

  function allowFileDrag(event: DragEvent) {
    if (![...event.dataTransfer.types].includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  const state = snapshot?.state;
  const missingTools = (["tmux", "ttyd"] as const).filter(
    (name) => snapshot?.tools && snapshot.tools[name] === false,
  );
  const connected = available && !!state && state.phase !== "idle";
  const status = !available
    ? "Bridge offline"
    : !state
      ? "Checking the bridge…"
      : state.phase === "working"
        ? (eventStatus[state.event?.type ?? ""] ??
          `Running ${state.event?.type ?? "an action"}`)
        : state.phase === "waiting"
          ? "Listening for Live actions"
          : state.phase === "error"
            ? "Reconnecting to Live…"
            : state.phase === "stopping"
              ? "Disconnecting…"
              : "Not connected";
  const watching = (state?.listening ?? []).map((name) =>
    name.replace(/^(apps|domains)\//, ""),
  );
  const detail = !available
    ? "The bridge isn't running. Restart bun dev to start it."
    : !state
      ? null
      : connected && watching.length
        ? `Watching ${watching.join(", ")}.`
        : connected
          ? "Waiting for a Live helper to come up."
          : "Runs Impeccable Live actions from every app in this repo through one agent on this machine.";
  const reducedMotion = useReducedMotion();
  const orb = sessionOrb(available, state?.phase, state?.event?.type);
  const output = state?.output ?? "";
  const apps = snapshot?.apps ?? [app];
  const agentValue = state?.agent ?? selectedAgent;
  const agentLabel =
    agents.find((agent) => agent.value === agentValue)?.label ?? agentValue;
  const appValue = state?.app ?? selectedApp;
  const appLabel = appValue.replace(/^(apps|domains)\//, "");

  useEffect(() => {
    if (!state?.terminal) return;
    const hasFiles = (event: globalThis.DragEvent) =>
      [...(event.dataTransfer?.types ?? [])].includes("Files");
    const enter = (event: globalThis.DragEvent) => {
      if (!hasFiles(event)) return;
      setDropping(true);
    };
    const over = (event: globalThis.DragEvent) => {
      if (!hasFiles(event)) return;
      if (dropping) event.preventDefault();
    };
    const end = () => setDropping(false);
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", end);
    window.addEventListener("dragend", end);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", end);
      window.removeEventListener("dragend", end);
    };
  }, [state?.terminal, dropping]);

  useEffect(() => {
    const node = outputRef.current;
    if (!node || !stickToEnd.current) return;
    node.scrollTop = node.scrollHeight;
  }, [output]);

  return (
    <div className="gap-4 @container flex min-h-full flex-col">
      <div className="gap-3 flex flex-wrap items-start justify-between">
        <div className="min-w-0 gap-1 flex flex-col" role="status">
          <p className="gap-2 font-medium flex items-center">
            <ThinkingOrb
              aria-hidden="true"
              state={orb}
              size={32}
              theme="auto"
              paused={reducedMotion}
            />
            <span className="truncate">{status}</span>
          </p>
          {detail && (
            <p className="text-xs text-pretty text-muted-foreground">
              {detail}
            </p>
          )}
          {connected ? (
            <p className="text-xs text-muted-foreground">
              <span className="text-foreground">{appLabel}</span>
              <span aria-hidden="true"> · </span>
              {agentLabel}
            </p>
          ) : null}
        </div>
        <div className="gap-2 flex shrink-0 items-center">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<a href={docsUrl} target="_blank" rel="noreferrer" />}
          >
            Docs
          </Button>
          {connected ? (
            <Button
              variant="outline"
              size="sm"
              disabled={state?.phase === "stopping"}
              onClick={() => void send("disconnect")}
            >
              Disconnect
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={!available || !snapshot}
              onClick={() => void send("connect")}
            >
              Connect
            </Button>
          )}
        </div>
      </div>
      {!connected && (
        <FieldGroup className="gap-4">
          <div className="gap-4 grid grid-cols-1 @min-[28rem]:grid-cols-2">
            <Field className="gap-2">
              <FieldLabel htmlFor="impeccable-bridge-app">App</FieldLabel>
              <NativeSelect
                id="impeccable-bridge-app"
                value={selectedApp}
                onChange={(event) => setSelectedApp(event.target.value)}
                disabled={!available}
                className="w-full"
              >
                {appGroups.map((group) => {
                  const members = apps.filter((name) =>
                    name.startsWith(group.prefix),
                  );
                  return members.length ? (
                    <NativeSelectOptGroup key={group.label} label={group.label}>
                      {members.map((name) => (
                        <NativeSelectOption key={name} value={name}>
                          {name.slice(group.prefix.length)}
                        </NativeSelectOption>
                      ))}
                    </NativeSelectOptGroup>
                  ) : null;
                })}
              </NativeSelect>
            </Field>
            <Field className="gap-2">
              <FieldLabel htmlFor="impeccable-bridge-agent">Agent</FieldLabel>
              <NativeSelect
                id="impeccable-bridge-agent"
                value={selectedAgent}
                onChange={(event) => setSelectedAgent(event.target.value)}
                disabled={!available}
                className="w-full"
              >
                {agents.map((agent) => (
                  <NativeSelectOption key={agent.value} value={agent.value}>
                    {agent.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </div>
        </FieldGroup>
      )}
      <div className="min-h-48 gap-2 flex flex-1 flex-col">
        <div className="gap-1 flex flex-col">
          <FieldLabel id="impeccable-agent-output-label">Session</FieldLabel>
          {missingTools.length ? (
            <p className="text-xs text-pretty text-muted-foreground">
              The live session needs {missingTools.join(" and ")} on this
              machine. Install with{" "}
              <code className="font-mono break-all text-foreground">
                brew install {missingTools.join(" ")}
              </code>
              {connected ? ", then disconnect and connect again." : "."}
            </p>
          ) : null}
        </div>
        {state?.terminal ? (
          <div
            className="min-h-48 relative w-full flex-1"
            onDragEnter={(event) => {
              if (![...event.dataTransfer.types].includes("Files")) return;
              event.preventDefault();
              dragDepth.current += 1;
              setDropping(true);
            }}
            onDragLeave={() => {
              dragDepth.current = Math.max(0, dragDepth.current - 1);
              if (dragDepth.current === 0) setDropping(false);
            }}
            onDragOver={allowFileDrag}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void dropFiles(event.dataTransfer.files);
            }}
          >
            <iframe
              title="Agent session"
              src={state.terminal}
              className="inset-0 bg-black absolute h-full w-full rounded-md border border-border"
            />
            {dropping ? (
              <div className="inset-0 px-4 text-sm absolute z-10 flex items-center justify-center rounded-md border border-dashed border-foreground/40 bg-background/80 text-center text-foreground">
                Drop to add to the agent
              </div>
            ) : null}
          </div>
        ) : (
          <pre
            ref={outputRef}
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-labelledby="impeccable-agent-output-label"
            className="min-h-48 p-2 font-mono text-xs flex-1 overflow-y-auto rounded-md border border-border bg-muted/50 break-words whitespace-pre-wrap"
            onScroll={(event) => {
              const node = event.currentTarget;
              stickToEnd.current =
                node.scrollHeight - node.scrollTop - node.clientHeight < 24;
            }}
          >
            {output || (
              <span className="text-muted-foreground">
                {missingTools.length
                  ? "Until then, Live actions still run. This pane stays a text log."
                  : connected
                    ? "Opening the agent terminal…"
                    : "Connect to watch the agent here."}
              </span>
            )}
          </pre>
        )}
      </div>
      {(actionError || state?.error) && (
        <Alert variant="destructive" className="shrink-0">
          <AlertDescription className="break-words">
            {actionError || state?.error}
          </AlertDescription>
        </Alert>
      )}
      {state?.history.length ? (
        <details className="text-xs shrink-0 text-muted-foreground">
          <summary className="min-h-11 font-medium sm:min-h-8 flex cursor-pointer items-center">
            Recent activity
          </summary>
          <ol className="max-h-32 gap-2 pb-1 flex flex-col overflow-y-auto">
            {state.history.slice(0, 8).map((item, index) => (
              <li key={`${item.time}-${index}`} className="gap-3 flex">
                <time className="shrink-0 tabular-nums">{item.time}</time>
                <span className="min-w-0 break-words">{item.message}</span>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  );
}
