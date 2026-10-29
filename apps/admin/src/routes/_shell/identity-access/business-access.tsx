import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_shell/identity-access/business-access")(
  {
    component: Outlet,
  },
);
