import {
  Button,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/ui";
import { InboxIcon, SearchXIcon } from "lucide-react";

export const Default = () => (
  <Empty className="border">
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <InboxIcon />
      </EmptyMedia>
      <EmptyTitle>No notifications yet</EmptyTitle>
      <EmptyDescription>
        Activity from the teams you belong to will show up here.
      </EmptyDescription>
    </EmptyHeader>
  </Empty>
);

export const WithAction = () => (
  <Empty className="border">
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <SearchXIcon />
      </EmptyMedia>
      <EmptyTitle>No people match this filter</EmptyTitle>
      <EmptyDescription>
        Try a different name, or clear the subsidiary and team filters.
      </EmptyDescription>
    </EmptyHeader>
    <EmptyContent>
      <Button size="sm" variant="outline">
        Clear filters
      </Button>
    </EmptyContent>
  </Empty>
);
