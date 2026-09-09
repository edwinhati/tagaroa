import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@repo/ui";

export const Sizes = () => (
  <div className="gap-4 flex items-end">
    <Avatar size="sm">
      <AvatarFallback>AO</AvatarFallback>
    </Avatar>
    <Avatar size="default">
      <AvatarFallback>BV</AvatarFallback>
    </Avatar>
    <Avatar size="lg">
      <AvatarFallback>CB</AvatarFallback>
    </Avatar>
  </div>
);

export const WithBadge = () => (
  <div className="gap-4 flex items-center">
    <Avatar size="lg">
      <AvatarFallback>AO</AvatarFallback>
      <AvatarBadge />
    </Avatar>
    <Avatar size="default">
      <AvatarFallback>BV</AvatarFallback>
      <AvatarBadge />
    </Avatar>
    <Avatar size="sm">
      <AvatarFallback>CB</AvatarFallback>
      <AvatarBadge />
    </Avatar>
  </div>
);

export const Group = () => (
  <AvatarGroup>
    <Avatar>
      <AvatarFallback>AO</AvatarFallback>
    </Avatar>
    <Avatar>
      <AvatarFallback>BV</AvatarFallback>
    </Avatar>
    <Avatar>
      <AvatarFallback>CB</AvatarFallback>
    </Avatar>
    <AvatarGroupCount>+5</AvatarGroupCount>
  </AvatarGroup>
);
