import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_shell/identity-access/")({
  beforeLoad: () => {
    throw redirect({ to: "/identity-access/work-queue" });
  },
});
