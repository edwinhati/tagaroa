import { createFileRoute } from "@tanstack/react-router";

import { RecentActivity } from "../events";

export const Route = createFileRoute("/_shell/identity-access/activity")({
  component: RecentActivity,
});
