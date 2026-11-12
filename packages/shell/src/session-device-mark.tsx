import { useTheme } from "@repo/ui/blocks/theme";
import { cn } from "@repo/ui/lib/utils";
import {
  Android,
  AppleDark,
  AppleLight,
  Chrome,
  Edge,
  Firefox,
  Safari,
  Windows,
} from "@ridemountainpig/svgl-react";
import type { SVGProps } from "react";

import type { SessionBrowser, SessionPlatform } from "./session-device";

type MarkProps = SVGProps<SVGSVGElement> & { className?: string };

const MARK = "size-4 shrink-0";

/**
 * Browser + OS marks for session tiles. Unknown keys render nothing —
 * never invent a logo.
 */
export function SessionDeviceMarks({
  browser,
  className,
  platform,
}: {
  browser: SessionBrowser | null;
  className?: string;
  platform: SessionPlatform | null;
}) {
  const { resolved } = useTheme();
  const props: MarkProps = {
    "aria-hidden": true,
    className: cn(MARK, className),
    height: 16,
    width: 16,
  };

  const Browser =
    browser === "chrome"
      ? Chrome
      : browser === "safari"
        ? Safari
        : browser === "edge"
          ? Edge
          : browser === "firefox"
            ? Firefox
            : null;

  const Platform =
    platform === "windows"
      ? Windows
      : platform === "android"
        ? Android
        : platform === "apple"
          ? resolved === "dark"
            ? AppleDark
            : AppleLight
          : null;

  if (!Browser && !Platform) return null;

  return (
    <span
      aria-hidden="true"
      className="gap-1 inline-flex shrink-0 items-center"
    >
      {Browser ? <Browser {...props} /> : null}
      {Platform ? <Platform {...props} /> : null}
    </span>
  );
}
