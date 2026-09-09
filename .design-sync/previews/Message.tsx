import {
  Avatar,
  AvatarFallback,
  Bubble,
  BubbleContent,
  BubbleGroup,
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

export const Grouped = () => (
  <Message className="max-w-lg">
    <MessageAvatar>
      <Avatar size="sm">
        <AvatarFallback>CB</AvatarFallback>
      </Avatar>
    </MessageAvatar>
    <MessageContent>
      <MessageHeader>Chidi Balogun · Finance</MessageHeader>
      <BubbleGroup>
        <Bubble variant="secondary">
          <BubbleContent>Suspended per the offboarding ticket.</BubbleContent>
        </Bubble>
        <Bubble variant="secondary">
          <BubbleContent>Sessions were revoked at the same time.</BubbleContent>
        </Bubble>
      </BubbleGroup>
      <MessageFooter>Delivered 11:02 AM</MessageFooter>
    </MessageContent>
  </Message>
);
