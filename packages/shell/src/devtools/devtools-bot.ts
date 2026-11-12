import { botAvatarTypes, type BotAvatarType } from "bot-avatars";
import { useEffect, useSyncExternalStore } from "react";

const storageKey = "tagaroa-devtools-bot";
const fallback: BotAvatarType = "droid";

let current: BotAvatarType = fallback;
let hydrated = false;
const listeners = new Set<() => void>();

function isBotType(value: string): value is BotAvatarType {
  return botAvatarTypes.includes(value as BotAvatarType);
}

function readStored(): BotAvatarType {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored && isBotType(stored)) return stored;
  } catch {
    // Private mode and disabled storage keep the default.
  }
  return fallback;
}

function emit() {
  for (const listener of listeners) listener();
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  const stored = readStored();
  if (stored === current) return;
  current = stored;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return current;
}

/** The bot shown on the DevTools launcher and in the Impeccable header. */
export function useDevtoolsBot() {
  const type = useSyncExternalStore(subscribe, getSnapshot, () => fallback);
  useEffect(hydrate, []);
  return type;
}

/** Advance to the next avatar. Wraps. Does not run on a timer. */
export function stepDevtoolsBot() {
  hydrate();
  const index = botAvatarTypes.indexOf(current);
  const next = botAvatarTypes[(index + 1) % botAvatarTypes.length] ?? fallback;
  current = next;
  hydrated = true;
  try {
    localStorage.setItem(storageKey, next);
  } catch {
    // The in-memory choice still applies for this page.
  }
  emit();
}
