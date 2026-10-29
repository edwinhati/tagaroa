import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_shell/policy")({
  beforeLoad: () => {
    throw redirect({ to: "/identity-access/privileged-access" });
  },
});
