import { Inject, Injectable } from "@nestjs/common";
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
} from "@nestjs/terminus";
import { sql } from "drizzle-orm";
import type { BunSQLDatabase } from "drizzle-orm/bun-sql";
import { DRIZZLE } from "../../../../shared/database/database.constants";

interface DrizzleHealthIndicatorOptions {
  timeout?: number;
}

/**
 * Drizzle ORM health indicator for database connectivity checks.
 * Performs a lightweight "SELECT 1" query to verify database availability.
 */
@Injectable()
export class DrizzleHealthIndicator extends HealthIndicator {
  constructor(@Inject(DRIZZLE) private readonly db: BunSQLDatabase) {
    super();
  }

  /**
   * Checks if the database connection is healthy by executing a test query.
   *
   * @param key - The key name for this health indicator in the response
   * @param options - Optional configuration (timeout)
   * @returns HealthIndicatorResult with status 'up' or 'down'
   * @throws HealthCheckError if the database is unreachable
   */
  async isHealthy(
    key: string,
    options: DrizzleHealthIndicatorOptions = {},
  ): Promise<HealthIndicatorResult> {
    const { timeout = 5000 } = options;

    try {
      const result = await this.runHealthCheckWithTimeout(timeout);
      return this.getStatus(key, true, result);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const result = this.getStatus(key, false, {
        message: errorMessage,
        timestamp: new Date().toISOString(),
      });
      throw new HealthCheckError("Drizzle health check failed", result);
    }
  }

  private async runHealthCheckWithTimeout(
    timeout: number,
  ): Promise<Record<string, unknown>> {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Health check timed out after ${timeout}ms`));
      }, timeout);
    });

    try {
      return await Promise.race([this.runHealthCheck(), timeoutPromise]);
    } finally {
      // Always clear the timer — prevents the losing promise from
      // holding a reference after the health check resolves or throws
      clearTimeout(timer);
    }
  }

  private async runHealthCheck(): Promise<Record<string, unknown>> {
    const startTime = performance.now();

    // Execute a lightweight query to verify database connectivity
    await this.db.execute(sql`SELECT 1`);

    const responseTime = Math.round(performance.now() - startTime);

    return {
      responseTimeMs: responseTime,
    };
  }
}
