import { appConfig } from "@repo/shell/vite";

// No `base`: this app answers on its own origin. It is not in
// `microfrontends.json` and the proxy never sees it.
export default appConfig({ port: 3003 });
