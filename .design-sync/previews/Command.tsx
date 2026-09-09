import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@repo/ui";
import { BuildingIcon, UserIcon, UsersIcon } from "lucide-react";

export const Palette = () => (
  <Command className="w-80 shadow-md rounded-xl border">
    <CommandInput placeholder="Search people, teams, subsidiaries..." />
    <CommandList>
      <CommandGroup heading="People">
        <CommandItem>
          <UserIcon />
          Ada Okonkwo
          <CommandShortcut>⌘1</CommandShortcut>
        </CommandItem>
        <CommandItem>
          <UserIcon />
          Bram de Vries
        </CommandItem>
      </CommandGroup>
      <CommandSeparator />
      <CommandGroup heading="Teams">
        <CommandItem>
          <UsersIcon />
          Supply chain
        </CommandItem>
        <CommandItem>
          <BuildingIcon />
          Tagaroa Netherlands B.V.
        </CommandItem>
      </CommandGroup>
    </CommandList>
  </Command>
);

export const Empty = () => (
  <Command className="w-80 shadow-md rounded-xl border">
    <CommandInput
      placeholder="Search people, teams, subsidiaries..."
      defaultValue="zzqx"
    />
    <CommandList>
      <CommandEmpty>No results found.</CommandEmpty>
    </CommandList>
  </Command>
);
