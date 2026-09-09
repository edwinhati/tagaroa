import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@repo/ui";

// Inline height (not a Tailwind h-* class): h-64 isn't in this wave's
// precompiled CSS, and a vertical PanelGroup with no definite parent height
// collapses to a hairline. defaultSize is a string ("35") for percentage —
// a bare number is pixels in this react-resizable-panels version.
export const Horizontal = () => (
  <div style={{ height: 256 }} className="max-w-xl w-full rounded-lg border">
    <ResizablePanelGroup orientation="horizontal">
      <ResizablePanel defaultSize="35">
        <div className="p-4 text-sm flex h-full items-center justify-center text-muted-foreground">
          Directory
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize="65">
        <div className="p-4 text-sm flex h-full items-center justify-center text-muted-foreground">
          Ada Okonkwo · Platform team
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>
);

export const Vertical = () => (
  <div style={{ height: 256 }} className="max-w-xl w-full rounded-lg border">
    <ResizablePanelGroup orientation="vertical">
      <ResizablePanel defaultSize="40">
        <div className="p-4 text-sm flex h-full items-center justify-center text-muted-foreground">
          Activity
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize="60">
        <div className="p-4 text-sm flex h-full items-center justify-center text-muted-foreground">
          Audit log detail
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>
);
