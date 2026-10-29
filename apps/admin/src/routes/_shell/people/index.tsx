import { createFileRoute, redirect } from "@tanstack/react-router";

import { validatePeopleSearch } from "../../../lib/admin";

export const Route = createFileRoute("/_shell/people/")({
  beforeLoad: ({ search }) => {
    throw redirect({ search, to: "/identity-access/people" });
  },
  validateSearch: validatePeopleSearch,
});
