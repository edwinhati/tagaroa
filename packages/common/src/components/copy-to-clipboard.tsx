"use client";

import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";

type CopyToClipboardProps = Readonly<{
  text: string;
  label: string;
}>;

export function CopyToClipboard({ text, label }: CopyToClipboardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(`${label} has been copied to your clipboard.`);

      // revert back to copy icon after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy to clipboard. Please try again.");
    }
  };

  return (
    <Button
      size="icon"
      variant="ghost"
      className="relative h-6 w-6 overflow-hidden"
      onClick={handleCopy}
    >
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center transition-opacity duration-300",
          copied ? "opacity-0" : "opacity-100",
        )}
      >
        <IconCopy className="h-3 w-3" />
      </span>
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center transition-opacity duration-300",
          copied ? "opacity-100" : "opacity-0",
        )}
      >
        <IconCheck className="h-3 w-3 text-green-500" />
      </span>
    </Button>
  );
}
