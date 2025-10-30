import { initPostHog } from "@repo/posthog-config/intrumentation-client";

initPostHog(
  process.env.NEXT_PUBLIC_POSTHOG_KEY!,
  process.env.NEXT_PUBLIC_POSTHOG_HOST,
);
