"use client";

import React, { useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@repo/ui/components/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";

const queryClient = new QueryClient();

export function AppProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize PostHog if not already initialized
    if (typeof window !== "undefined" && !posthog.__loaded) {
      const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
      const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

      if (key) {
        posthog.init(key, {
          api_host: host,
          capture_pageview: false,
          disable_session_recording: false,
          respect_dnt: true,
          bootstrap: {
            featureFlags: {},
          },
        });
      }
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <PostHogProvider client={posthog}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors />
        </ThemeProvider>
      </PostHogProvider>
    </QueryClientProvider>
  );
}
