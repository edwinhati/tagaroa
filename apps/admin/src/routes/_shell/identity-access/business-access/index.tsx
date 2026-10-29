import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_shell/identity-access/business-access/",
)({
  beforeLoad: () => {
    throw redirect({
      to: "/identity-access/business-access/assignments",
    });
  },
});
