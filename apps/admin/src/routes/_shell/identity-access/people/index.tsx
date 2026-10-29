import { createFileRoute } from "@tanstack/react-router";

import { validatePeopleSearch } from "../../../../lib/admin";
import { People } from "../../index";

export const Route = createFileRoute("/_shell/identity-access/people/")({
  component: People,
  validateSearch: validatePeopleSearch,
});
