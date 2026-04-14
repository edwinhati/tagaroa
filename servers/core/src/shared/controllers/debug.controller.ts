import { Controller, Get, UseGuards } from "@nestjs/common";
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
}
