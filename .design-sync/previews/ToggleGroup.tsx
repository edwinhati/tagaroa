import { ToggleGroup, ToggleGroupItem } from "@repo/ui";
import { AlignCenterIcon, AlignLeftIcon, AlignRightIcon } from "lucide-react";

export const Default = () => (
  <ToggleGroup defaultValue={["left"]}>
    <ToggleGroupItem value="left" aria-label="Align left">
      <AlignLeftIcon />
    </ToggleGroupItem>
    <ToggleGroupItem value="center" aria-label="Align center">
      <AlignCenterIcon />
    </ToggleGroupItem>
    <ToggleGroupItem value="right" aria-label="Align right">
      <AlignRightIcon />
    </ToggleGroupItem>
  </ToggleGroup>
);

export const Outline = () => (
  <ToggleGroup variant="outline" defaultValue={["week"]}>
    <ToggleGroupItem value="day">Day</ToggleGroupItem>
    <ToggleGroupItem value="week">Week</ToggleGroupItem>
    <ToggleGroupItem value="month">Month</ToggleGroupItem>
  </ToggleGroup>
);

export const Sizes = () => (
  <div className="gap-4 flex flex-col items-start">
    <ToggleGroup size="sm" variant="outline" defaultValue={["active"]}>
      <ToggleGroupItem value="active">Active</ToggleGroupItem>
      <ToggleGroupItem value="suspended">Suspended</ToggleGroupItem>
      <ToggleGroupItem value="invited">Invited</ToggleGroupItem>
    </ToggleGroup>
    <ToggleGroup size="lg" variant="outline" defaultValue={["active"]}>
      <ToggleGroupItem value="active">Active</ToggleGroupItem>
      <ToggleGroupItem value="suspended">Suspended</ToggleGroupItem>
      <ToggleGroupItem value="invited">Invited</ToggleGroupItem>
    </ToggleGroup>
  </div>
);
