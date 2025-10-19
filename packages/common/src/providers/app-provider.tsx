"use client";

import React from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@repo/ui/components/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";

const queryClient = new QueryClient();

// PostHog is initialized in instrumentation files, not here

export function AppProvider({ children }: { children: React.ReactNode }) {
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
