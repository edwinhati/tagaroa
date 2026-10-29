import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_shell/business-access/roles")({
  beforeLoad: () => {
    throw redirect({ to: "/identity-access/business-access/roles" });
  },
});
