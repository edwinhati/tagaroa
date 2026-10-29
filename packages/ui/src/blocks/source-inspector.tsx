import { useEffect, useRef } from "react";

export function SourceInspectorBridge() {
  const active = useRef(false);
  const source = useRef<string | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  const label = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const overlay = document.createElement("div");
    const tag = document.createElement("div");
    Object.assign(overlay.style, {
      position: "fixed",
      display: "none",
      pointerEvents: "none",
      zIndex: "2147483646",
      border: "2px solid var(--ring)",
      background: "color-mix(in srgb, var(--ring) 14%, transparent)",
    });
    Object.assign(tag.style, {
      position: "fixed",
      display: "none",
      pointerEvents: "none",
      zIndex: "2147483647",
      padding: "2px 5px",
      color: "white",
      background: "var(--ring)",
      font: "12px/1.2 ui-monospace, monospace",
      whiteSpace: "nowrap",
    });
    document.body.append(overlay, tag);
    box.current = overlay;
    label.current = tag;

    const setTarget = (event: MouseEvent) => {
      if (!active.current) return;
      const element = document.elementFromPoint(event.clientX, event.clientY);
      const target = element?.closest<HTMLElement>("[data-tsd-source]");
      if (!target || target.id.startsWith("impeccable-live-")) {
        source.current = null;
        overlay.style.display = "none";
        tag.style.display = "none";
        return;
      }
      source.current = target.dataset.tsdSource ?? null;
      const rect = target.getBoundingClientRect();
      Object.assign(overlay.style, {
        display: "block",
        left: `${rect.left - 2}px`,
        top: `${rect.top - 2}px`,
        width: `${rect.width + 4}px`,
        height: `${rect.height + 4}px`,
      });
      Object.assign(tag.style, {
        display: "block",
        left: `${Math.max(4, rect.left)}px`,
        top: `${rect.top < 28 ? rect.bottom + 4 : rect.top - 22}px`,
      });
      tag.textContent = source.current ?? "";
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.shiftKey && !event.metaKey && !event.ctrlKey) {
        active.current = true;
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (!event.altKey || !event.shiftKey) {
        active.current = false;
        source.current = null;
        overlay.style.display = "none";
        tag.style.display = "none";
      }
    };
    const onClick = (event: MouseEvent) => {
      if (!active.current || !source.current) return;
      const currentSource = source.current;
      event.preventDefault();
      event.stopImmediatePropagation();
      const base = new URL(import.meta.env.BASE_URL ?? "/", location.origin);
      void fetch(
        new URL(
          `__tsd/open-source?source=${encodeURIComponent(currentSource)}`,
          base,
        ),
      );
    };

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("keyup", onKeyUp, true);
    document.addEventListener("mousemove", setTarget, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("keyup", onKeyUp, true);
      document.removeEventListener("mousemove", setTarget, true);
      document.removeEventListener("click", onClick, true);
      overlay.remove();
      tag.remove();
    };
  }, []);

  return null;
}
