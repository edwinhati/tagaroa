import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_shell/activity")({
  beforeLoad: () => {
    throw redirect({ to: "/identity-access/activity" });
  },
});
