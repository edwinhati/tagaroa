"use client";

import { Button } from "@repo/ui/components/button";
import { Spinner } from "@repo/ui/components/spinner";
import { cn } from "@repo/ui/lib/utils";
import { IconAlertCircle, IconRefresh } from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface TradingViewWidget {
  new (config: TradingViewWidgetConfig): unknown;
}

interface TradingViewWidgetConfig {
  container_id: string;
  width: string | number;
  height: string | number;
  symbol: string;
  interval: string;
  timezone: string;
  theme: "light" | "dark";
  style: string;
  locale: string;
  toolbar_bg?: string;
  enable_publishing: boolean;
  allow_symbol_change: boolean;
  hide_side_toolbar?: boolean;
  save_image?: boolean;
  studies?: string[];
  show_popup_button?: boolean;
  popup_width?: string;
  popup_height?: string;
}

declare global {
  interface Window {
    TradingView?: {
      widget: TradingViewWidget;
    };
  }
}

// Global script manager to handle TradingView script loading
class TradingViewScriptManager {
  private static instance: TradingViewScriptManager;
  private isLoaded = false;
  private isLoading = false;
  private callbacks: Array<() => void> = [];
  private errorCallbacks: Array<(error: Error) => void> = [];

  static getInstance(): TradingViewScriptManager {
    if (!TradingViewScriptManager.instance) {
      TradingViewScriptManager.instance = new TradingViewScriptManager();
    }
    return TradingViewScriptManager.instance;
  }

  loadScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      // If already loaded, resolve immediately
      if (this.isLoaded && window.TradingView?.widget) {
        resolve();
        return;
      }

      // Add callbacks to queue
      this.callbacks.push(resolve);
      this.errorCallbacks.push(reject);

      // If already loading, just wait
      if (this.isLoading) {
        return;
      }

      // Check if script already exists
      if (window.TradingView?.widget) {
        this.isLoaded = true;
        this.executeCallbacks();
        return;
      }

      this.isLoading = true;

      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/tv.js";
      script.async = true;
      script.type = "text/javascript";

      script.onload = () => {
        this.isLoaded = true;
        this.isLoading = false;
        this.executeCallbacks();
      };

      script.onerror = () => {
        this.isLoading = false;
        const error = new Error("Failed to load TradingView script");
        this.executeErrorCallbacks(error);
      };

      document.head.appendChild(script);
    });
  }

  private executeCallbacks() {
    for (const callback of this.callbacks) {
      callback();
    }
    this.callbacks = [];
    this.errorCallbacks = [];
  }

  private executeErrorCallbacks(error: Error) {
    for (const callback of this.errorCallbacks) {
      callback(error);
    }
    this.callbacks = [];
    this.errorCallbacks = [];
  }
}

interface TradingViewChartProps {
  symbol?: string;
  interval?:
    | "1"
    | "3"
    | "5"
    | "15"
    | "30"
    | "60"
    | "120"
    | "240"
    | "D"
    | "W"
    | "M";
  theme?: "light" | "dark";
  height?: number | string;
  allowSymbolChange?: boolean;
  enablePublishing?: boolean;
  timezone?: string;
  locale?: string;
  style?: "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
  hideSideToolbar?: boolean;
  studies?: string[];
  className?: string;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Premium TradingView Chart Component
 *
 * A robust wrapper around the TradingView Technical Analysis Widget.
 * Features:
 * - Managed script loading
 * - Premium loading & error states
 * - Automatic cleanup
 * - Dark/Light theme support
 */
export function TradingViewChart({
  symbol = "NASDAQ:AAPL",
  interval = "D",
  theme = "dark",
  height = 500,
  allowSymbolChange = true,
  enablePublishing = false,
  timezone = "Etc/UTC",
  locale = "en",
  style = "1",
  hideSideToolbar = false,
  studies = [],
  className = "",
  onLoad,
  onError,
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<unknown>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [containerId] = useState(
    () => `tradingview-widget-${Math.random().toString(36).substring(2, 11)}`,
  );
  const scriptManager = TradingViewScriptManager.getInstance();

  const createWidget = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      // Ensure script is loaded
      await scriptManager.loadScript();

      if (!window.TradingView?.widget) {
        throw new Error("TradingView widget not available");
      }

      // Clear any existing widget
      const widgetContainer = document.getElementById(containerId);
      if (widgetContainer) {
        widgetContainer.innerHTML = "";
      }

      const config: TradingViewWidgetConfig = {
        container_id: containerId,
        width: "100%",
        height: "100%",
        symbol,
        interval,
        timezone,
        theme,
        style,
        locale,
        toolbar_bg: theme === "light" ? "#f1f3f6" : "#131722",
        enable_publishing: enablePublishing,
        allow_symbol_change: allowSymbolChange,
        hide_side_toolbar: hideSideToolbar,
        save_image: false,
        studies,
        show_popup_button: true,
        popup_width: "1000",
        popup_height: "650",
      };

      widgetRef.current = new window.TradingView.widget(config);
      setIsLoading(false);
      setError(null);
      onLoad?.();
    } catch (err) {
      console.error("TradingView Error:", err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to create TradingView widget";
      setError(errorMessage);
      setIsLoading(false);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
    }
  }, [
    containerId,
    symbol,
    interval,
    timezone,
    theme,
    style,
    locale,
    enablePublishing,
    allowSymbolChange,
    hideSideToolbar,
    studies,
    onLoad,
    onError,
    scriptManager,
  ]);

  const retry = useCallback(() => {
    setIsLoading(true);
    setError(null);
    createWidget();
  }, [createWidget]);

  useEffect(() => {
    createWidget();

    return () => {
      // Only clean up the widget content, not the script
      const widgetContainer = document.getElementById(containerId);
      if (widgetContainer) {
        widgetContainer.innerHTML = "";
      }
      widgetRef.current = null;
    };
  }, [createWidget, containerId]);

  return (
    <div
      className={cn(
        "group relative w-full overflow-hidden rounded-xl border border-border/50 bg-card shadow-sm transition-all hover:border-border/80",
        className,
      )}
      style={{ height }}
    >
      {/* Loading Overlay */}
      {isLoading && !error && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-card/60 backdrop-blur-md transition-all duration-300">
          <div className="relative mb-4">
            <div className="absolute -inset-4 rounded-full bg-primary/20 blur-xl animate-pulse" />
            <Spinner className="relative size-8 text-primary" />
          </div>
          <div className="flex flex-col items-center space-y-1">
            <span className="text-sm font-medium tracking-tight">
              Initializing Chart
            </span>
            <span className="text-xs text-muted-foreground animate-pulse">
              Syncing market data...
            </span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center space-y-6 bg-card/80 p-6 text-center backdrop-blur-xl">
          <div className="relative">
            <div className="absolute -inset-4 rounded-full bg-destructive/10 blur-2xl" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive shadow-inner ring-1 ring-destructive/20">
              <IconAlertCircle size={32} stroke={1.5} />
            </div>
          </div>

          <div className="max-w-[280px] space-y-2">
            <h3 className="text-lg font-semibold tracking-tight">
              External Service Error
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {error ||
                "The TradingView service is temporarily unavailable. This could be due to connectivity issues or script blocking."}
            </p>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={retry}
            className="group/btn h-10 px-6 transition-all active:scale-95"
          >
            <IconRefresh
              size={16}
              className="mr-2 transition-transform duration-500 group-hover/btn:rotate-180"
            />
            Try Again
          </Button>
        </div>
      )}

      {/* Widget Container */}
      <div
        ref={containerRef}
        className={cn(
          "h-full w-full transition-opacity duration-700",
          isLoading ? "opacity-0" : "opacity-100",
        )}
      >
        <div id={containerId} className="h-full w-full" />
      </div>

      {/* Glassy Border Effect */}
      <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/5" />
    </div>
  );
}
