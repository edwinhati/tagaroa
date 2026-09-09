import { Kbd, KbdGroup } from "@repo/ui";

export const Shortcuts = () => (
  <div className="gap-3 flex flex-col">
    <div className="gap-2 flex items-center">
      <span className="text-sm text-foreground">Command palette</span>
      <KbdGroup>
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </KbdGroup>
    </div>
    <div className="gap-2 flex items-center">
      <span className="text-sm text-foreground">Issue account</span>
      <KbdGroup>
        <Kbd>Ctrl</Kbd>
        <Kbd>Shift</Kbd>
        <Kbd>N</Kbd>
      </KbdGroup>
    </div>
  </div>
);

export const Single = () => (
  <div className="gap-1 flex items-center">
    <Kbd>Esc</Kbd>
    <span className="text-sm text-muted-foreground">to close</span>
  </div>
);
