import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { HealthService } from "./application/services/health.service";
import { DrizzleHealthIndicator } from "./infrastructure/health/drizzle-health.indicator";
import { HealthController } from "./presentation/health/health.controller";

/**
 * Health Module provides application health monitoring capabilities.
 *
 * Features:
 * - Liveness probe (/health/live) - Kubernetes liveness check
 * - Readiness probe (/health/ready) - Kubernetes readiness check
 * - Comprehensive health check (/health) - Full system status
 *
 * Implements best practices from NestJS Terminus:
 * - `micro-use-health-checks`: Health checks for orchestration
 * - `arch-feature-modules`: Organized by feature
 * - `di-prefer-constructor-injection`: Proper DI patterns
 */
@Module({
  imports: [TerminusModule.forRoot({ logger: false })],
  controllers: [HealthController],
  providers: [HealthService, DrizzleHealthIndicator],
  exports: [HealthService],
})
export class HealthModule {}
