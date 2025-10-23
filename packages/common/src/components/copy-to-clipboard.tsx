"use client";

import React, { useState } from "react";
import { cn } from "@repo/ui/lib/utils";

import { toast } from "sonner";
import { Button } from "@repo/ui/components/button";

import { CopyIcon, CheckIcon } from "lucide-react";

export function CopyToClipboard({
  text,
  label,
}: {
  text: string;
  label: string;
}) {
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
        <CopyIcon className="h-3 w-3" />
      </span>
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center transition-opacity duration-300",
          copied ? "opacity-100" : "opacity-0",
        )}
      >
        <CheckIcon className="h-3 w-3 text-green-500" />
      </span>
    </Button>
  );
}
