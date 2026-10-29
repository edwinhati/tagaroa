import { createFileRoute } from "@tanstack/react-router";

import { validatePeopleSearch } from "../../../lib/admin";
import { PersonWorkspace } from "../people.$personId";

export const Route = createFileRoute(
  "/_shell/identity-access/people/$personId",
)({
  component: PersonRoute,
  validateSearch: validatePeopleSearch,
});

function PersonRoute() {
  const { personId } = Route.useParams();
  const search = Route.useSearch();

  return <PersonWorkspace personId={personId} search={search} />;
}
