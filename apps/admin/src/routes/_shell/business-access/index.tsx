import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_shell/business-access/")({
  beforeLoad: () => {
    throw redirect({ to: "/identity-access/business-access/assignments" });
  },
});
