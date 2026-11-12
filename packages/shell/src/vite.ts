import { readFileSync } from "node:fs";

import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { mergeConfig, type UserConfig } from "vite";

const readJson = (path: string | URL) => JSON.parse(readFileSync(path, "utf8"));

/** The port `microfrontends.json` gives the app being configured, if it is one of the workspace's. */
const microfrontendPort = (): number | undefined => {
  const { name } = readJson(`${process.cwd()}/package.json`);
  const { applications } = readJson(
    new URL("../../../apps/workspace/microfrontends.json", import.meta.url),
  );
  return applications[name]?.development?.local?.port;
};

/**
 * Every app's Vite config. An app in `microfrontends.json` takes its port from
 * there (turbo also passes it as TURBO_MFE_PORT); any other app names its own.
 */
export function appConfig({
  port = microfrontendPort(),
  ...config
}: UserConfig & { port?: number } = {}): UserConfig {
  if (!port)
    throw new Error(
      "Give appConfig a port, or list the app in microfrontends.json.",
    );
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
