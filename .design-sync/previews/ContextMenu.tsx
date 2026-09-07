import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@repo/ui";

export const Default = () => (
  <ContextMenu defaultOpen>
    <ContextMenuTrigger className="h-40 w-64 text-sm flex items-center justify-center rounded-md border border-dashed text-muted-foreground">
      Right-click a row
    </ContextMenuTrigger>
    <ContextMenuContent>
      <ContextMenuGroup>
        <ContextMenuLabel>Ada Okonkwo</ContextMenuLabel>
      </ContextMenuGroup>
      <ContextMenuSeparator />
      <ContextMenuItem>
        View profile
        <ContextMenuShortcut>⌘P</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem>Reassign team</ContextMenuItem>
      <ContextMenuCheckboxItem checked>
        Show in directory
      </ContextMenuCheckboxItem>
      <ContextMenuSub>
        <ContextMenuSubTrigger>Grant access</ContextMenuSubTrigger>
        <ContextMenuSubContent>
          <ContextMenuItem>Domain administrator</ContextMenuItem>
          <ContextMenuItem>Emergency access</ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuSeparator />
      <ContextMenuItem variant="destructive">Suspend account</ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>
);

export const Simple = () => (
  <ContextMenu defaultOpen>
    <ContextMenuTrigger className="h-40 w-64 text-sm flex items-center justify-center rounded-md border border-dashed text-muted-foreground">
      Right-click the audit entry
    </ContextMenuTrigger>
    <ContextMenuContent>
      <ContextMenuItem>Copy event ID</ContextMenuItem>
      <ContextMenuItem>Open actor profile</ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem variant="destructive">Flag for review</ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>
);
