import { PostHog } from "posthog-node";

export function PostHogClient(key: string, host: string) {
  if (!key) {
    throw new Error("PostHog key is required");
  }

  const posthogClient = new PostHog(key, {
    host: host,
    // More reasonable flush settings for production
    flushAt: 20, // Flush after 20 events
    flushInterval: 10000, // Flush every 10 seconds
    // Enable request timeout
    requestTimeout: 3000,
  });

  return posthogClient;
}
