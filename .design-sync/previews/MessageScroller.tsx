import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@repo/ui";

const thread = [
  {
    id: "m1",
    from: "Ada Okonkwo",
    text: "Kessler Logistics contract is signed, uploading now.",
  },
  {
    id: "m2",
    from: "Bram de Vries",
    text: "Thanks — I'll route it to finance for countersign.",
  },
  {
    id: "m3",
    from: "Ada Okonkwo",
    text: "Also flagging: their team needs a subsidiary assignment before go-live.",
  },
  {
    id: "m4",
    from: "Chidi Balogun",
    text: "I can grant Domain administrator scoped to the subsidiary once it exists.",
  },
  {
    id: "m5",
    from: "Bram de Vries",
    text: "Created — Kessler Logistics BV, parented under Supply chain.",
  },
  {
    id: "m6",
    from: "Ada Okonkwo",
    text: "Perfect, assigning Chidi's team now.",
  },
  {
    id: "m7",
    from: "Chidi Balogun",
    text: "Confirmed, access shows up on my end.",
  },
  {
    id: "m8",
    from: "Bram de Vries",
    text: "Closing this out — audit log entry is filed under today's date.",
  },
];

const Thread = () => (
  <MessageScroller className="rounded-lg border bg-card">
    <MessageScrollerViewport>
      <MessageScrollerContent className="p-4">
        {thread.map((m) => (
          <MessageScrollerItem key={m.id} messageId={m.id}>
            <p className="text-xs font-medium text-muted-foreground">
              {m.from}
            </p>
            <p className="text-sm">{m.text}</p>
          </MessageScrollerItem>
        ))}
      </MessageScrollerContent>
    </MessageScrollerViewport>
    <MessageScrollerButton />
  </MessageScroller>
);

// Tailwind's precompiled sheet only carries utility classes already scanned
// from packages/ui/src; h-72/w-96 aren't among them here, so the fixed pixel
// box below uses inline style to guarantee the explicit container size this
// component needs regardless of that scan.
export const Scrollable = () => (
  <MessageScrollerProvider defaultScrollPosition="end">
    <div style={{ height: 280, width: 380 }}>
      <Thread />
    </div>
  </MessageScrollerProvider>
);

export const PinnedToStart = () => (
  <MessageScrollerProvider defaultScrollPosition="start">
    <div style={{ height: 280, width: 380 }}>
      <Thread />
    </div>
  </MessageScrollerProvider>
);
