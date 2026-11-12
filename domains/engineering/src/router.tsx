import { createAppRouter } from "@repo/shell/router";

import { routeTree } from "./routeTree.gen";

export const getRouter = () => createAppRouter(routeTree);
