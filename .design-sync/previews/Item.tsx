import {
  Badge,
  Button,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@repo/ui";

export const List = () => (
  <ItemGroup className="max-w-lg p-2 rounded-lg bg-muted/40">
    <Item>
      <ItemContent>
        <ItemTitle>Ada Okonkwo</ItemTitle>
        <ItemDescription>
          Head of supply chain · signed in 4 minutes ago
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Badge variant="secondary">Active</Badge>
      </ItemActions>
    </Item>
    <Item>
      <ItemContent>
        <ItemTitle>Bram de Vries</ItemTitle>
        <ItemDescription>
          Engineering · invitation sent 2 days ago, not yet accepted
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Badge variant="outline">Invited</Badge>
        <Button size="sm" variant="ghost">
          Resend
        </Button>
      </ItemActions>
    </Item>
    <Item>
      <ItemContent>
        <ItemTitle>Chidi Balogun</ItemTitle>
        <ItemDescription>
          Finance · suspended by an administrator on 12 August
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Badge variant="destructive">Suspended</Badge>
      </ItemActions>
    </Item>
  </ItemGroup>
);

export const Variants = () => (
  <ItemGroup className="max-w-lg">
    <Item variant="outline">
      <ItemContent>
        <ItemTitle>Outline</ItemTitle>
        <ItemDescription>A bounded row, used standalone.</ItemDescription>
      </ItemContent>
    </Item>
    <Item variant="muted">
      <ItemContent>
        <ItemTitle>Muted</ItemTitle>
        <ItemDescription>Recedes against the ground.</ItemDescription>
      </ItemContent>
    </Item>
  </ItemGroup>
);
