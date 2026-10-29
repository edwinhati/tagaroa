import { createFileRoute } from "@tanstack/react-router";

import { PrivilegedAccess } from "../privileged-access";

export const Route = createFileRoute(
  "/_shell/identity-access/privileged-access",
)({
  component: PrivilegedAccess,
});
