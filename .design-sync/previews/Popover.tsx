import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@repo/ui";

export const Open = () => (
  <Popover defaultOpen>
    <PopoverTrigger
      render={
        <Button variant="outline">
          <Avatar size="sm">
            <AvatarFallback>AO</AvatarFallback>
          </Avatar>
          Ada Okonkwo
        </Button>
      }
    />
    <PopoverContent>
      <PopoverHeader>
        <PopoverTitle>Ada Okonkwo</PopoverTitle>
        <PopoverDescription>
          Domain administrator · Supply chain
        </PopoverDescription>
      </PopoverHeader>
      <Badge variant="secondary">Active this week</Badge>
      <Button size="sm" variant="outline">
        View profile
      </Button>
    </PopoverContent>
  </Popover>
);
