import { createAppRouter } from "@repo/shell/router";
// Before the route tree: its modules define Zod schemas on import.
import "@repo/shell/zod-jitless";

import { routeTree } from "./routeTree.gen";

export const getRouter = () => createAppRouter(routeTree);
