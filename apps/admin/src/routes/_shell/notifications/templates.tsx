import { createFileRoute } from "@tanstack/react-router";

import { TemplatesPage } from "../../../components/notifications/notification-console";

export const Route = createFileRoute("/_shell/notifications/templates")({
  component: TemplatesPage,
});
