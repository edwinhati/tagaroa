import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "@repo/ui";
import { SearchIcon, XIcon } from "lucide-react";

export const Search = () => (
  <InputGroup className="max-w-sm">
    <InputGroupInput placeholder="Search the directory..." defaultValue="Ada" />
    <InputGroupAddon>
      <SearchIcon />
    </InputGroupAddon>
    <InputGroupAddon align="inline-end">
      <InputGroupButton size="icon-xs" aria-label="Clear search">
        <XIcon />
      </InputGroupButton>
    </InputGroupAddon>
  </InputGroup>
);

export const WithButton = () => (
  <InputGroup className="max-w-sm">
    <InputGroupInput placeholder="person@tagaroa.com" />
    <InputGroupAddon align="inline-end">
      <InputGroupButton variant="outline" size="sm">
        Invite
      </InputGroupButton>
    </InputGroupAddon>
  </InputGroup>
);

export const TextareaWithCount = () => (
  <InputGroup className="max-w-sm">
    <InputGroupTextarea
      placeholder="Reason for emergency access..."
      defaultValue="Payroll run is blocked and the on-call approver is unreachable."
    />
    <InputGroupAddon align="block-end">
      <InputGroupText>63 / 240</InputGroupText>
    </InputGroupAddon>
  </InputGroup>
);
