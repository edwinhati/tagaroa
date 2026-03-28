import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  HealthCheckResult,
  HealthIndicatorFunction,
} from "@nestjs/terminus";
import {
  DiskHealthIndicator,
  HealthCheckService,
  MemoryHealthIndicator,
} from "@nestjs/terminus";
import type { AppConfig } from "../../../../shared/config/env.validation";
import { DrizzleHealthIndicator } from "../../infrastructure/health/drizzle-health.indicator";

/**
 * Health service responsible for orchestrating various health checks.
 * Implements the microservices best practice `micro-use-health-checks`.
 *
 * Thresholds are driven by environment variables so they can be tuned
 * per deployment without code changes:
 *   HEALTH_MEMORY_HEAP_THRESHOLD_MB  (default: 512)
 *   HEALTH_MEMORY_RSS_THRESHOLD_MB   (default: 1024)
 *   HEALTH_DISK_THRESHOLD_PERCENT    (default: 0.8)
 */
@Injectable()
export class HealthService {
  private readonly heapThreshold: number;
  private readonly rssThreshold: number;
  private readonly diskThreshold: number;

  constructor(
    private readonly health: HealthCheckService,
    private readonly disk: DiskHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly drizzleHealth: DrizzleHealthIndicator,
    private readonly config: ConfigService<AppConfig, true>,
  ) {
    const MB = 1024 * 1024;
    this.heapThreshold =
      this.config.get("HEALTH_MEMORY_HEAP_THRESHOLD_MB") * MB;
    this.rssThreshold = this.config.get("HEALTH_MEMORY_RSS_THRESHOLD_MB") * MB;
    this.diskThreshold = this.config.get("HEALTH_DISK_THRESHOLD_PERCENT");
  }

  /**
   * Liveness probe — lightweight, no external dependencies.
   * Kubernetes uses this to decide if the container needs restarting.
   */
  async checkLiveness(): Promise<HealthCheckResult> {
    const checks: HealthIndicatorFunction[] = [
      () => this.memory.checkHeap("memory_heap", this.heapThreshold),
    ];

    return this.health.check(checks);
  }

  /**
   * Readiness probe — verifies critical dependencies are reachable.
   * Kubernetes uses this to decide if the pod should receive traffic.
   */
  async checkReadiness(): Promise<HealthCheckResult> {
    const checks: HealthIndicatorFunction[] = [
      () => this.drizzleHealth.isHealthy("database", { timeout: 3000 }),
    ];

    return this.health.check(checks);
  }

  /**
   * Comprehensive check — all indicators.
   * Used by monitoring dashboards and alerting.
   */
  async checkAll(): Promise<HealthCheckResult> {
    const checks: HealthIndicatorFunction[] = [
      () => this.drizzleHealth.isHealthy("database", { timeout: 5000 }),
      () =>
        this.disk.checkStorage("storage", {
          path: "/",
          thresholdPercent: this.diskThreshold,
        }),
      () => this.memory.checkHeap("memory_heap", this.heapThreshold),
      () => this.memory.checkRSS("memory_rss", this.rssThreshold),
    ];

    return this.health.check(checks);
  }
}
