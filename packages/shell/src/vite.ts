import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { mergeConfig, type UserConfig } from "vite";

/**
 * Every app's Vite config. `port` is the app's standalone port; under
 * `turbo dev`, turbo sets TURBO_MFE_PORT from `microfrontends.json`.
 */
export function appConfig({
  port,
  ...config
}: UserConfig & { port: number }): UserConfig {
  return mergeConfig(
    {
      // The SPA prerender serves the build on `localhost` and fetches it on
      // 127.0.0.1. Where localhost resolves to ::1 first (Docker), that misses.
      preview: { host: true },
      server: {
        port: Number(process.env.TURBO_MFE_PORT) || port,
        // Vite walks to the next free port when this one is taken, which puts
        // the app on an origin nothing has been told to trust.
        strictPort: true,
      },
      plugins: [
        devtools({ consolePiping: { enabled: false } }),
        tailwindcss(),
        tanstackStart({ spa: { enabled: true } }),
        // After start's plugin, which it must follow.
        viteReact(),
      ],
    },
    config,
  );
}
