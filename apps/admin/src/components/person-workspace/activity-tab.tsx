import { Button } from "@repo/ui/components/button";
import { relativeTime } from "@repo/ui/lib/relative-time";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { dashboardQueryOptions } from "../../lib/directory";
import { eventAction } from "../../lib/identity-operations";
import { type Person } from "../../lib/people";
import { FIGURE, MONO, PANEL } from "../admin-surface";
import { MutedLine, Row } from "./tab-row";

export function ActivityTab({ person }: { person: Person }) {
  const dashboard = useQuery(dashboardQueryOptions);
  const recentEvents = (dashboard.data?.events ?? [])
    .filter(
      (event) =>
        event.target === person.email ||
        event.target === person.name ||
        event.actor === person.email,
    )
    .slice(0, 6);

  return (
    <div className={PANEL}>
      <Row title="Account">
        <div className="mt-2 gap-4 sm:grid-cols-2 grid">
          <Fact
            label="Created"
            value={new Date(person.createdAt).toLocaleDateString()}
          />
          <Fact label="User ID" mono value={person.id} />
          {person.banned ? (
            <Fact
              label="Suspension reason"
              value={person.banReason || "No reason recorded"}
            />
          ) : null}
        </div>
      </Row>
      <Row
        action={
          <Button
            nativeButton={false}
            render={<Link to="/identity-access/activity" />}
            size="sm"
            variant="ghost"
          >
            View all activity
          </Button>
        }
        title="Recent activity"
      >
        {recentEvents.length === 0 ? (
          <MutedLine>No recent activity for this account.</MutedLine>
        ) : (
          <ul className="mt-1.5 flex flex-col">
            {recentEvents.map((event) => (
              <li
                className="gap-3 py-1.5 flex items-baseline justify-between"
                key={event.id}
              >
                <p className="text-[13px]">{eventAction(event)}</p>
                <time
                  className={`${FIGURE} shrink-0 text-muted-foreground`}
                  dateTime={new Date(event.at).toISOString()}
                >
                  {relativeTime(event.at)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </Row>
    </div>
  );
}

function Fact({
  label,
  mono = false,
  value,
}: {
  label: string;
  mono?: boolean;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[12.5px] text-muted-foreground">{label}</p>
      <p
        className={`${mono ? MONO : "text-[13px]"} mt-1 break-words`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}
