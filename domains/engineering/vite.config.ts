import { appConfig } from "@repo/shell/vite";

// The proxy mounts this app at /engineering; the router takes the same base.
export default appConfig({ base: "/engineering" });
