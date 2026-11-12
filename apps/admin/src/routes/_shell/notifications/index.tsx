import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_shell/notifications/")({
  beforeLoad: () => {
    throw redirect({ to: "/notifications/overview" });
  },
});
