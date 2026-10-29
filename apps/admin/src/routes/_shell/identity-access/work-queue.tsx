import { createFileRoute } from "@tanstack/react-router";

import { WorkQueue } from "../overview";

export const Route = createFileRoute("/_shell/identity-access/work-queue")({
  component: WorkQueue,
});
