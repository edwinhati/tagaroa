import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_shell/reviews")({
  beforeLoad: () => {
    throw redirect({ to: "/identity-access/reviews" });
  },
});
