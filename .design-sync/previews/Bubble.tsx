import {
  Avatar,
  AvatarFallback,
  Bubble,
  BubbleContent,
  BubbleGroup,
  BubbleReactions,
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageGroup,
  MessageHeader,
} from "@repo/ui";

export const Conversation = () => (
  <MessageGroup className="max-w-lg">
    <Message>
      <MessageAvatar>
        <Avatar size="sm">
          <AvatarFallback>BV</AvatarFallback>
        </Avatar>
      </MessageAvatar>
      <MessageContent>
        <MessageHeader>Bram de Vries · 9:14 AM</MessageHeader>
        <BubbleGroup>
          <Bubble variant="muted">
            <BubbleContent>
              The subsidiary field is still empty on two new accounts.
            </BubbleContent>
          </Bubble>
          <Bubble variant="muted">
            <BubbleContent>
              Can you assign them before the access review closes?
            </BubbleContent>
            <BubbleReactions>👍</BubbleReactions>
          </Bubble>
        </BubbleGroup>
      </MessageContent>
    </Message>
    <Message align="end">
      <MessageAvatar>
        <Avatar size="sm">
          <AvatarFallback>AO</AvatarFallback>
        </Avatar>
      </MessageAvatar>
      <MessageContent>
        <BubbleGroup>
          <Bubble align="end">
            <BubbleContent>
              On it — flagging both under No subsidiary now.
            </BubbleContent>
          </Bubble>
        </BubbleGroup>
        <MessageFooter>Read 9:16 AM</MessageFooter>
      </MessageContent>
    </Message>
  </MessageGroup>
);

export const Variants = () => (
  <div className="max-w-lg gap-2 flex flex-col">
    <Bubble variant="default">
      <BubbleContent>Default — the sender's own bubble.</BubbleContent>
    </Bubble>
    <Bubble variant="secondary">
      <BubbleContent>Secondary — a neutral reply.</BubbleContent>
    </Bubble>
    <Bubble variant="muted">
      <BubbleContent>Muted — recedes for system context.</BubbleContent>
    </Bubble>
    <Bubble variant="tinted">
      <BubbleContent>Tinted — a soft brand wash.</BubbleContent>
    </Bubble>
    <Bubble variant="outline">
      <BubbleContent>Outline — bordered, transparent fill.</BubbleContent>
    </Bubble>
    <Bubble variant="ghost">
      <BubbleContent>Ghost — no chrome, just the text.</BubbleContent>
    </Bubble>
    <Bubble variant="destructive">
      <BubbleContent>Destructive — an account was suspended.</BubbleContent>
    </Bubble>
  </div>
);
