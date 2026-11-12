import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_shell/")({
  beforeLoad: () => {
    throw redirect({ to: "/identity-access/work-queue" });
  },
});
