import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    // Turborepo's microfrontends proxy hands the real port through
    // TURBO_MFE_PORT on the dev script; this is the standalone default.
    port: 3002,
    // Vite walks to the next free port when this one is taken, which puts the
    // app somewhere the proxy and the configured origins do not know about.
    // Fail loudly instead.
    strictPort: true,
  },
  plugins: [
    devtools({ consolePiping: { enabled: false } }),
    tailwindcss(),
    tanstackStart({ spa: { enabled: true } }),
    // react plugin must come after start's plugin
    viteReact(),
  ],
});
