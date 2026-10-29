import { createFileRoute, redirect } from "@tanstack/react-router";

const destinations = {
  activity: "/notifications/delivery",
  suppressed: "/notifications/suppressions",
  wording: "/notifications/templates",
} as const;

type LegacyTab = keyof typeof destinations;

export const Route = createFileRoute("/_shell/notifications/")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab:
      typeof search.tab === "string" && search.tab in destinations
        ? (search.tab as LegacyTab)
        : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: search.tab ? destinations[search.tab] : "/notifications/overview",
    });
  },
});
