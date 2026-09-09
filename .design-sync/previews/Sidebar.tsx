import {
  Avatar,
  AvatarFallback,
  Badge,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
} from "@repo/ui";
import {
  ActivityIcon,
  BellIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "lucide-react";

export const Workspace = () => (
  <SidebarProvider>
    <Sidebar>
      <SidebarHeader>
        <div className="gap-2 px-2 py-1 flex items-center">
          <Avatar className="size-6">
            <AvatarFallback>T</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium">Tagaroa</span>
        </div>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Identity &amp; access</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive>
                  <UsersIcon />
                  <span>Directory</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <ShieldCheckIcon />
                  <span>Roles &amp; access</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <ActivityIcon />
                  <span>Activity</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <BellIcon />
                  <span>Notifications</span>
                </SidebarMenuButton>
                <SidebarMenuBadge>3</SidebarMenuBadge>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="gap-2 px-2 py-1 flex items-center">
          <Avatar className="size-6">
            <AvatarFallback>AO</AvatarFallback>
          </Avatar>
          <div className="leading-tight flex flex-col">
            <span className="text-xs font-medium">Ada Okonkwo</span>
            <span className="text-xs text-muted-foreground">Super-admin</span>
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
    <SidebarInset>
      <div className="gap-2 p-4 flex items-center border-b">
        <span className="text-sm font-medium">Directory</span>
        <Badge variant="secondary">50 people</Badge>
      </div>
      <div className="p-4 text-sm text-muted-foreground">
        Ada Okonkwo · Platform team · Domain administrator
      </div>
    </SidebarInset>
  </SidebarProvider>
);

export const Collapsed = () => (
  <SidebarProvider defaultOpen={false}>
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="px-2 py-1 flex items-center justify-center">
          <Avatar className="size-6">
            <AvatarFallback>T</AvatarFallback>
          </Avatar>
        </div>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive tooltip="Directory">
                  <UsersIcon />
                  <span>Directory</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Roles & access">
                  <ShieldCheckIcon />
                  <span>Roles &amp; access</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Activity">
                  <ActivityIcon />
                  <span>Activity</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
    <SidebarInset>
      <div className="gap-2 p-4 flex items-center border-b">
        <span className="text-sm font-medium">Directory</span>
      </div>
    </SidebarInset>
  </SidebarProvider>
);
