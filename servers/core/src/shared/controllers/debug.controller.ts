import { Controller, Get, Post, UseGuards } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { MonitoringService } from "../../modules/observability/application/monitoring.service";
import { BunProfilingService } from "../../modules/observability/application/profiling.service";
import { DevelopmentGuard } from "../guards/development.guard";

@Controller("debug")
@AllowAnonymous()
@UseGuards(DevelopmentGuard)
export class DebugController {
  constructor(
    private readonly monitoring: MonitoringService,
    private readonly profiling: BunProfilingService,
  ) {}

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

  @Post("profiling/start")
  startProfiling(): { message: string } {
    this.profiling.startProfiling();
    return { message: "Profiling started" };
  }

  @Post("profiling/stop")
  stopProfiling(): { message: string } {
    this.profiling.stopProfiling();
    return { message: "Profiling stopped" };
  }

  @Get("profiling/stats")
  getProfilingStats(): ReturnType<BunProfilingService["getStats"]> {
    return this.profiling.getStats();
  }

  @Get("profiling/report")
  getProfilingReport(): string {
    return this.profiling.generateReport();
  }

  @Get("profiling/export")
  exportProfilingData(): string {
    return this.profiling.exportToJSON();
  }
}
