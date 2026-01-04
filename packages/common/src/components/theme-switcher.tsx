"use client";

import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { LoaderIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import React from "react";

export function ThemeSwitcher() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Prevent hydration mismatch by only rendering after mount
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Return a placeholder that matches the expected structure
    return (
      <div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="outline" aria-label="Select theme">
              <LoaderIcon className="w-4 h-4 animate-spin" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-32">
            <DropdownMenuItem>
              <SunIcon size={16} className="opacity-60" aria-hidden="true" />
              <span>Light</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <MoonIcon size={16} className="opacity-60" aria-hidden="true" />
              <span>Dark</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <MonitorIcon
                size={16}
                className="opacity-60"
                aria-hidden="true"
              />
              <span>System</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  // Use resolvedTheme which handles system preference and is consistent between server/client
  const displayTheme = resolvedTheme || theme;

  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="outline" aria-label="Select theme">
            {displayTheme === "light" && (
              <SunIcon size={16} aria-hidden="true" />
            )}
            {displayTheme === "dark" && (
              <MoonIcon size={16} aria-hidden="true" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-32">
          <DropdownMenuItem onClick={() => setTheme("light")}>
            <SunIcon size={16} className="opacity-60" aria-hidden="true" />
            <span>Light</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("dark")}>
            <MoonIcon size={16} className="opacity-60" aria-hidden="true" />
            <span>Dark</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("system")}>
            <MonitorIcon size={16} className="opacity-60" aria-hidden="true" />
            <span>System</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
