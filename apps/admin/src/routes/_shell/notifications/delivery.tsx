import { createFileRoute } from "@tanstack/react-router";

import {
  DeliveryLogPage,
  validateDeliverySearch,
} from "../../../components/notifications/notification-console";

export const Route = createFileRoute("/_shell/notifications/delivery")({
  validateSearch: validateDeliverySearch,
  component: DeliveryRoute,
});

function DeliveryRoute() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();

  return (
    <DeliveryLogPage
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
