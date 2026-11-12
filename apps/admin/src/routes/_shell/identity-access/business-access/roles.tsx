import { createFileRoute } from "@tanstack/react-router";

import { BusinessAccess } from "../../../../components/business-access";

export const Route = createFileRoute(
  "/_shell/identity-access/business-access/roles",
)({
  component: () => <BusinessAccess view="roles" />,
});
