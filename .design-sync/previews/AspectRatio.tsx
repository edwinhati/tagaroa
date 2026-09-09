import { AspectRatio, Badge } from "@repo/ui";
import { FileTextIcon, PlayIcon } from "lucide-react";

export const Media = () => (
  <div className="max-w-sm gap-2 flex flex-col">
    <AspectRatio
      ratio={16 / 9}
      className="flex items-center justify-center overflow-hidden rounded-md bg-muted"
    >
      <PlayIcon aria-hidden="true" className="size-8 text-muted-foreground" />
      <Badge className="right-2 bottom-2 absolute" variant="secondary">
        4:12
      </Badge>
    </AspectRatio>
    <p className="text-sm font-medium text-foreground">
      Quarterly access review — recorded walkthrough
    </p>
  </div>
);

export const Document = () => (
  <div className="w-24">
    <AspectRatio
      ratio={1}
      className="flex items-center justify-center overflow-hidden rounded-md border border-border bg-muted"
    >
      <FileTextIcon
        aria-hidden="true"
        className="size-6 text-muted-foreground"
      />
    </AspectRatio>
  </div>
);
