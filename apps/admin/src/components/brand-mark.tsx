import { useTheme } from "@repo/ui/blocks/theme";
import { cn } from "@repo/ui/lib/utils";
import {
  Meta,
  ResendDark,
  ResendLight,
  Twilio,
  WhatsApp,
} from "@ridemountainpig/svgl-react";
import type { SVGProps } from "react";

type MarkProps = SVGProps<SVGSVGElement> & { className?: string };

const MARK = "size-3.5 shrink-0";

/**
 * Delivery providers wear their own marks. Unknown names render nothing so a
 * hand-rolled string never invents a logo.
 */
export function ProviderMark({
  className,
  provider,
}: {
  className?: string;
  provider: string;
}) {
  const { resolved } = useTheme();
  const key = provider.trim().toLowerCase();
  const props: MarkProps = {
    "aria-hidden": true,
    className: cn(MARK, className),
    height: 14,
    width: 14,
  };

  if (key === "resend") {
    // ResendDark = pale mark for dark surfaces; ResendLight = ink for light.
    const Resend = resolved === "dark" ? ResendDark : ResendLight;
    return <Resend {...props} />;
  }
  if (key === "twilio") return <Twilio {...props} />;
  if (key === "meta" || key === "facebook") return <Meta {...props} />;
  if (key === "whatsapp") return <WhatsApp {...props} />;

  return null;
}

/** Channel marks that have a recognisable brand; others stay Lucide. */
export function WhatsAppMark({ className }: { className?: string }) {
  return (
    <WhatsApp
      aria-hidden
      className={cn(MARK, className)}
      height={14}
      width={14}
    />
  );
}
