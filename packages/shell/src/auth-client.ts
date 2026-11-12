import { createWorkspaceAuthClient } from "./create-auth-client";
import { CORE_URL } from "./urls";

/** The client every workspace app reads its session through. */
export const authClient = createWorkspaceAuthClient(CORE_URL);
