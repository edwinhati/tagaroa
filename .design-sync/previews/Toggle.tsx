import { Toggle } from "@repo/ui";
import { ArchiveIcon, StarIcon, UserIcon } from "lucide-react";

export const Variants = () => (
  <div className="gap-2 flex items-center">
    <Toggle variant="default" defaultPressed>
      <StarIcon />
      Starred
    </Toggle>
    <Toggle variant="outline">
      <ArchiveIcon />
      Show archived
    </Toggle>
    <Toggle variant="outline" defaultPressed>
      <UserIcon />
      Mine only
    </Toggle>
  </div>
);

export const Sizes = () => (
  <div className="gap-2 flex items-center">
    <Toggle variant="outline" size="sm" defaultPressed>
      sm
    </Toggle>
    <Toggle variant="outline" size="default" defaultPressed>
      default
    </Toggle>
    <Toggle variant="outline" size="lg" defaultPressed>
      lg
    </Toggle>
  </div>
);

export const Disabled = () => (
  <div className="gap-2 flex items-center">
    <Toggle variant="outline" disabled>
      Show archived
    </Toggle>
    <Toggle variant="outline" defaultPressed disabled>
      Mine only
    </Toggle>
  </div>
);
