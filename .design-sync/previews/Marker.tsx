import { Marker, MarkerContent, MarkerIcon } from "@repo/ui";
import { CheckIcon, ClockIcon, UserIcon } from "lucide-react";

export const Variants = () => (
  <div className="max-w-md gap-4 flex flex-col">
    <Marker>
      <MarkerIcon>
        <ClockIcon />
      </MarkerIcon>
      <MarkerContent>Imported from Workday · 2 hours ago</MarkerContent>
    </Marker>
    <Marker variant="separator">Today</Marker>
    <Marker variant="border">
      <MarkerIcon>
        <CheckIcon />
      </MarkerIcon>
      <MarkerContent>Last synced 3 minutes ago</MarkerContent>
    </Marker>
  </div>
);

export const Timeline = () => (
  <div className="max-w-md gap-3 p-4 flex flex-col rounded-lg border bg-card">
    <p className="text-sm font-medium text-card-foreground">
      Domain administrator · supply chain
    </p>
    <Marker>
      <MarkerIcon>
        <UserIcon />
      </MarkerIcon>
      <MarkerContent>Requested by Bram de Vries</MarkerContent>
    </Marker>
    <Marker>
      <MarkerIcon>
        <CheckIcon />
      </MarkerIcon>
      <MarkerContent>Approved by Chidi Balogun, a super-admin</MarkerContent>
    </Marker>
    <Marker variant="separator">12 Aug</Marker>
    <Marker>
      <MarkerIcon>
        <ClockIcon />
      </MarkerIcon>
      <MarkerContent>Granted, expires in 15 minutes</MarkerContent>
    </Marker>
  </div>
);
