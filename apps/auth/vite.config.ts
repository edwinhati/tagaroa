import { appConfig } from "@repo/shell/vite";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return appConfig({
    port: 3001,
    server: {
      // Bind IPv4 too — otherwise the proxy listens on [::1] only and some
      // clients hit 127.0.0.1 and miss the door.
      host: true,
      // Auth calls must look first-party to the browser. A direct cross-origin
      // call to the core service (8080) lets Brave/Safari drop Set-Cookie, so
      // sign-in appears to succeed while getSession stays null.
      proxy: {
        "/api/auth": {
          changeOrigin: true,
          // Preserve Set-Cookie host as the door's origin, not :8080.
          cookieDomainRewrite: "",
          target: env.VITE_AUTH_BASE_URL ?? "http://127.0.0.1:8080",
        },
      },
    },
  });
});
