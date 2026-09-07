import {
  Button,
  Kbd,
  KbdGroup,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui";

export const Open = () => (
  <TooltipProvider>
    <Tooltip open>
      <TooltipTrigger render={<Button variant="outline" size="sm" />}>
        Command palette
      </TooltipTrigger>
      <TooltipContent>
        Open command palette
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);
