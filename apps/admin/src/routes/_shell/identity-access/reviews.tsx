import { createFileRoute } from "@tanstack/react-router";

import { Reviews } from "../security";

export const Route = createFileRoute("/_shell/identity-access/reviews")({
  component: Reviews,
});
