import { Button } from "@repo/ui/components/button";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

type Theme = "light" | "dark" | "system";
type Resolved = "light" | "dark";

const THEME_STORAGE_KEY = "tagaroa-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Runs before paint in the document head, so a forced theme never flashes.
 *
 * It always writes a `light` or `dark` class, resolving "system" itself, because
 * Tailwind's `dark:` variant keys off that class: leaving it unset under system
 * dark mode switched the tokens but not the variants that read them.
 */
export const themeBootScript = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t!=='dark'&&t!=='light'){t=matchMedia('${DARK_QUERY}').matches?'dark':'light'}document.documentElement.classList.add(t)}catch(e){}})()`;

interface ThemeContextValue {
  /** What the person chose, which is what the toggle labels itself with. */
  theme: Theme;
  /** What that choice looks like right now, which is what the page renders. */
  resolved: Resolved;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return context;
}

function readStored(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

/**
 * The stored theme and the OS preference are both external state, so they are
 * read rather than mirrored into component state — which also keeps two open
 * tabs in step, since a write in one fires `storage` in the other.
 *
 * The snapshot is a string so `useSyncExternalStore` can compare it by value.
 */
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener("storage", emit);
    window.matchMedia(DARK_QUERY).addEventListener("change", emit);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("storage", emit);
      window.matchMedia(DARK_QUERY).removeEventListener("change", emit);
    }
  };
}

function snapshot(): string {
  const stored = readStored();
  if (stored !== "system") return `${stored} ${stored}`;
  return window.matchMedia(DARK_QUERY).matches ? "system dark" : "system light";
}

/** The server cannot see localStorage; the inline head script covers first paint. */
function serverSnapshot(): string {
  return "system light";
}

function applyClass(resolved: Resolved) {
  const root = document.documentElement;
  if (root.classList.contains(resolved)) return;

  // A theme flip changes colour, background, border and shadow on nearly every
  // element at once. Left alone every transition on those fires together and the
  // switch smears, so they are suppressed for the frame the swap happens in.
  const freeze = document.createElement("style");
  freeze.textContent = "*,*::before,*::after{transition:none !important}";
  root.append(freeze);

  root.classList.remove("light", "dark");
  root.classList.add(resolved);

  void freeze.offsetHeight; // Force the reflow that commits the new colours.
  requestAnimationFrame(() => freeze.remove());
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const [theme, resolved] = state.split(" ") as [Theme, Resolved];

  useEffect(() => applyClass(resolved), [resolved]);

  const setTheme = useCallback((next: Theme) => {
    try {
      if (next === "system") localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // A blocked storage API is not a reason to refuse the theme change.
    }
    emit();
  }, []);

  const value = useMemo(
    () => ({ theme, resolved, setTheme }),
    [theme, resolved, setTheme],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

const LABELS: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

const NEXT: Record<Theme, Theme> = {
  light: "dark",
  dark: "system",
  system: "light",
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(NEXT[theme])}
      aria-label={`Theme: ${LABELS[theme]}. Switch to ${LABELS[NEXT[theme]]}.`}
      title={`Theme: ${LABELS[theme]}`}
      className="text-muted-foreground focus-visible:ring-ring"
    >
      <ThemeIcon theme={theme} />
    </Button>
  );
}

function ThemeIcon({ theme }: { theme: Theme }) {
  const common = {
    "aria-hidden": true,
    fill: "none",
    height: 17,
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.6,
    viewBox: "0 0 24 24",
    width: 17,
  };

  if (theme === "light") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.6v2.2M12 19.2v2.2M4.4 4.4l1.6 1.6M18 18l1.6 1.6M2.6 12h2.2M19.2 12h2.2M4.4 19.6L6 18M18 6l1.6-1.6" />
      </svg>
    );
  }

  if (theme === "dark") {
    return (
      <svg {...common}>
        <path d="M20 13.4A8.2 8.2 0 1 1 10.6 4a6.6 6.6 0 0 0 9.4 9.4Z" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <rect height="12.4" rx="2" width="18" x="3" y="4" />
      <path d="M8.5 20.4h7M12 16.4v4" />
    </svg>
  );
}
