import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_shell/identity-access/policy")({
  beforeLoad: () => {
    throw redirect({ to: "/identity-access/privileged-access" });
  },
});
