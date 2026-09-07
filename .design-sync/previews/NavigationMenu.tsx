import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@repo/ui";

export const Open = () => (
  <NavigationMenu defaultValue="access">
    <NavigationMenuList>
      <NavigationMenuItem value="access">
        <NavigationMenuTrigger>Identity & access</NavigationMenuTrigger>
        <NavigationMenuContent>
          <ul className="w-56 gap-1 flex flex-col">
            <li>
              <NavigationMenuLink href="#">Roles & access</NavigationMenuLink>
            </li>
            <li>
              <NavigationMenuLink href="#">People</NavigationMenuLink>
            </li>
            <li>
              <NavigationMenuLink href="#">Activity log</NavigationMenuLink>
            </li>
          </ul>
        </NavigationMenuContent>
      </NavigationMenuItem>
      <NavigationMenuItem>
        <NavigationMenuLink href="#">Notifications</NavigationMenuLink>
      </NavigationMenuItem>
    </NavigationMenuList>
  </NavigationMenu>
);
