import { Controller, Get, UseGuards } from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { MonitoringService } from "../../modules/observability/application/monitoring.service";
import { DevelopmentGuard } from "../guards/development.guard";

@Controller("debug")
@AllowAnonymous()
@UseGuards(DevelopmentGuard)
export class DebugController {
  constructor(private readonly monitoring: MonitoringService) {}

  @Get("sentry-error")
  triggerError(): string {
    this.monitoring.addBreadcrumb("Test breadcrumb", "debug", { test: true });
    this.monitoring.captureMessage("Test message from debug endpoint", "info");
    throw new Error("This is a test error for Sentry integration");
  }

  @Get("sentry-performance")
  async triggerPerformanceSpan(): Promise<{
    message: string;
    duration: number;
  }> {
    const startTime = Date.now();

    const result = await this.monitoring.startSpan(
      "debug-performance-test",
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { processed: true };
      },
      { test: true, endpoint: "/debug/sentry-performance" },
    );

    const duration = Date.now() - startTime;

    return {
      message: "Performance test completed",
      duration,
      ...result,
    };
  }

  @Get("sentry-message")
  sendMessage(): { message: string } {
    this.monitoring.captureMessage(
      "Info message from debug controller",
      "info",
      {
        endpoint: "/debug/sentry-message",
        timestamp: new Date().toISOString(),
      },
    );

    this.monitoring.captureMessage(
      "Warning message from debug controller",
      "warning",
      {
        level: "test",
      },
    );

    this.monitoring.addBreadcrumb("User action", "user", {
      action: "test_message",
    });

    return { message: "Messages sent to Sentry" };
  }

  @Get("sentry-metrics")
  triggerMetrics(): { message: string; metrics: string[] } {
    Sentry.metrics.count("debug.button_click", 1);
    Sentry.metrics.gauge("debug.memory_usage", process.memoryUsage().heapUsed, {
      unit: "byte",
    });
    Sentry.metrics.distribution(
      "debug.response_time",
      Math.random() * 500 + 50,
      {
        unit: "millisecond",
      },
    );

    return {
      message: "Metrics emitted to Sentry",
      metrics: [
        "debug.button_click (count)",
        "debug.memory_usage (gauge)",
        "debug.response_time (distribution)",
      ],
    };
  }

  @Get("sentry-logs")
  triggerLogs(): { message: string } {
    Sentry.logger.trace("Trace log from debug endpoint", {
      endpoint: "/debug/sentry-logs",
    });
    Sentry.logger.debug("Debug log from debug endpoint", {
      endpoint: "/debug/sentry-logs",
    });
    Sentry.logger.info("Info log from debug endpoint", {
      endpoint: "/debug/sentry-logs",
      timestamp: new Date().toISOString(),
    });
    Sentry.logger.warn("Warning log from debug endpoint", {
      endpoint: "/debug/sentry-logs",
    });
    Sentry.logger.error("Error log from debug endpoint", {
      endpoint: "/debug/sentry-logs",
    });

    // Also trigger via console so consoleLoggingIntegration captures them
    console.log("[Sentry Test] console.log captured as Sentry log");
    console.warn("[Sentry Test] console.warn captured as Sentry log");
    console.error("[Sentry Test] console.error captured as Sentry log");

    return { message: "Logs sent to Sentry" };
  }
}
