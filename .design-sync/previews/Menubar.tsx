import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@repo/ui";

export const Default = () => (
  <Menubar>
    <MenubarMenu defaultOpen>
      <MenubarTrigger>Directory</MenubarTrigger>
      <MenubarContent>
        <MenubarItem>
          Add person
          <MenubarShortcut>⌘N</MenubarShortcut>
        </MenubarItem>
        <MenubarItem>Import from CSV</MenubarItem>
        <MenubarSeparator />
        <MenubarItem>Export directory</MenubarItem>
      </MenubarContent>
    </MenubarMenu>
    <MenubarMenu>
      <MenubarTrigger>Roles &amp; access</MenubarTrigger>
      <MenubarContent>
        <MenubarItem>New custom role</MenubarItem>
        <MenubarItem>Assign to team</MenubarItem>
      </MenubarContent>
    </MenubarMenu>
    <MenubarMenu>
      <MenubarTrigger>Activity</MenubarTrigger>
      <MenubarContent>
        <MenubarItem>View audit log</MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  </Menubar>
);

export const WithCheckboxes = () => (
  <Menubar>
    <MenubarMenu defaultOpen>
      <MenubarTrigger>View</MenubarTrigger>
      <MenubarContent>
        <MenubarGroup>
          <MenubarLabel>Columns</MenubarLabel>
          <MenubarCheckboxItem checked>Team</MenubarCheckboxItem>
          <MenubarCheckboxItem checked>Role</MenubarCheckboxItem>
          <MenubarCheckboxItem>Last sign-in</MenubarCheckboxItem>
        </MenubarGroup>
        <MenubarSeparator />
        <MenubarItem variant="destructive">Reset to defaults</MenubarItem>
      </MenubarContent>
    </MenubarMenu>
    <MenubarMenu>
      <MenubarTrigger>Notifications</MenubarTrigger>
      <MenubarContent>
        <MenubarItem>Mark all as read</MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  </Menubar>
);
