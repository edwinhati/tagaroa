import { Button } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/tabs";
import { BotAvatar } from "bot-avatars";
import { XIcon } from "lucide-react";
import { type ReactNode, useState, useSyncExternalStore } from "react";

import { stepDevtoolsBot, useDevtoolsBot } from "./devtools-bot";

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

export type DevtoolsTool = {
  id: string;
  label: string;
  icon: ReactNode;
  content: ReactNode;
};

/**
 * The floating Tagaroa DevTools panel. Each tool is a tab; only the active
 * one is mounted, so a tool's polling stops while it is out of view.
 */
export function InternalDevtools({ tools }: { tools: DevtoolsTool[] }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(tools[0]?.id);
  const botType = useDevtoolsBot();
  const reducedMotion = useReducedMotion();

  return (
    <aside
      id="internal-devtools"
      className="gap-3 sm:bottom-[max(1rem,env(safe-area-inset-bottom,0px))] pointer-events-none fixed end-[max(1rem,env(safe-area-inset-inline-end,0px))] bottom-[max(5rem,env(safe-area-inset-bottom,0px))] z-[2147482000] flex w-[min(42rem,calc(100vw-2rem-env(safe-area-inset-left,0px)-env(safe-area-inset-right,0px)))] max-w-full flex-col items-stretch"
      aria-label="Tagaroa DevTools"
    >
      {open && (
        <Card
          id="internal-devtools-panel"
          size="sm"
          className="gap-0 py-0 ease-out sm:max-h-[calc(100dvh-6rem-env(safe-area-inset-bottom,0px))] pointer-events-auto flex h-[min(85dvh,52rem)] max-h-[calc(100dvh-9rem-env(safe-area-inset-bottom,0px))] w-full origin-bottom-right flex-col overflow-hidden border border-border shadow-[var(--panel-shadow)] ring-0 transition-[opacity,scale] duration-150 rtl:origin-bottom-left starting:scale-[0.97] starting:opacity-0 motion-reduce:starting:scale-100"
        >
          <Tabs
            value={active}
            onValueChange={setActive}
            className="min-h-0 gap-0 flex flex-1 flex-col"
          >
            <div className="gap-2 ps-1 pe-1 flex items-center border-b">
              <TabsList
                variant="line"
                className="min-w-0 flex-1 justify-start overflow-x-auto"
              >
                {tools.map((tool) => (
                  <TabsTrigger
                    key={tool.id}
                    value={tool.id}
                    className="flex-none"
                  >
                    {tool.icon}
                    {tool.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              <div className="gap-1 flex shrink-0 items-center">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Next bot avatar"
                  onClick={stepDevtoolsBot}
                >
                  <BotAvatar
                    aria-hidden="true"
                    type={botType}
                    state="default"
                    size={22}
                    interactive={false}
                    paused={reducedMotion}
                    className="pointer-events-none"
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Close DevTools"
                  onClick={() => setOpen(false)}
                >
                  <XIcon />
                </Button>
              </div>
            </div>
            {tools.map((tool) => (
              <TabsContent
                key={tool.id}
                value={tool.id}
                className="min-h-0 p-4 flex flex-1 flex-col overflow-y-auto"
              >
                {tool.content}
              </TabsContent>
            ))}
          </Tabs>
        </Card>
      )}
      <Button
        variant="secondary"
        size="icon-lg"
        className="pointer-events-auto self-end rounded-full"
        aria-label={open ? "Close DevTools" : "Open DevTools"}
        title="Tagaroa DevTools"
        aria-expanded={open}
        aria-controls="internal-devtools-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <BotAvatar
          aria-hidden="true"
          type={botType}
          state="default"
          size={32}
          interactive={false}
          paused={reducedMotion}
          className="pointer-events-none"
        />
      </Button>
    </aside>
  );
}
