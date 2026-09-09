import {
  Button,
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from "@repo/ui";
import { CheckIcon, PencilIcon, TrashIcon } from "lucide-react";

export const Horizontal = () => (
  <ButtonGroup>
    <Button variant="outline">Approve</Button>
    <Button variant="outline">Deny</Button>
    <Button variant="outline">Escalate</Button>
  </ButtonGroup>
);

export const WithSeparatorAndText = () => (
  <ButtonGroup>
    <ButtonGroupText>Bulk action</ButtonGroupText>
    <ButtonGroupSeparator />
    <Button variant="outline" size="icon">
      <CheckIcon />
    </Button>
    <Button variant="outline" size="icon">
      <PencilIcon />
    </Button>
    <Button variant="outline" size="icon">
      <TrashIcon />
    </Button>
  </ButtonGroup>
);

export const Vertical = () => (
  <ButtonGroup orientation="vertical">
    <Button variant="outline">Grant access</Button>
    <Button variant="outline">Revoke access</Button>
    <Button variant="outline">View audit log</Button>
  </ButtonGroup>
);
