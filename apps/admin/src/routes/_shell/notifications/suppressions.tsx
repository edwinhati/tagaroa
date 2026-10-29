import { createFileRoute } from "@tanstack/react-router";

import {
  SuppressionsPage,
  validateSuppressionSearch,
} from "../../../components/notifications/notification-console";

export const Route = createFileRoute("/_shell/notifications/suppressions")({
  validateSearch: validateSuppressionSearch,
  component: SuppressionsRoute,
});

function SuppressionsRoute() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();

  return (
    <SuppressionsPage
      onSearchChange={(change) => {
        void navigate({
          replace: true,
          search: (current) => ({ ...current, ...change }),
        });
      }}
      search={search}
    />
  );
}
