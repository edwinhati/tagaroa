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
  <ItemGroup className="max-w-lg p-2 rounded-xl bg-card border border-border shadow-sm">
    <Item>
      <ItemContent>
        <ItemTitle>Ada Okonkwo</ItemTitle>
        <ItemDescription>
          Head of supply chain · signed in 4 minutes ago
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Badge data-status="success" variant="outline">Active</Badge>
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
        <Badge data-status="info" variant="outline">Invited</Badge>
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
        <Badge data-status="danger" variant="outline">Suspended</Badge>
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
