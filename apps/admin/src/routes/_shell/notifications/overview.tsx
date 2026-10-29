import { createFileRoute } from "@tanstack/react-router";

import { NotificationOverviewPage } from "../../../components/notifications/notification-console";

export const Route = createFileRoute("/_shell/notifications/overview")({
  component: NotificationOverviewPage,
});
