import { createFileRoute, Outlet } from "@tanstack/react-router";

import { validatePeopleSearch } from "../../../lib/admin";

export const Route = createFileRoute("/_shell/identity-access/people")({
  component: Outlet,
  validateSearch: validatePeopleSearch,
});
