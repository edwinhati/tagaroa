import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // No `base`: this app answers on its own origin, not on a path of the
  // workspace's. It is not in `microfrontends.json` and the proxy never sees it.
  server: {
    port: 3003,
    // Vite walks to the next free port when this one is taken, which puts the
    // app on an origin nothing has been told to trust. Fail loudly instead.
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
