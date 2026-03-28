import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { HealthCheck, HealthCheckResult } from "@nestjs/terminus";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { HealthService } from "../../application/services/health.service";

/**
 * Health check controller implementing Kubernetes-compatible probes.
 *
 * Endpoints:
 * - GET /health - Comprehensive health check for monitoring
 * - GET /health/live - Liveness probe (lightweight, no external deps)
 * - GET /health/ready - Readiness probe (includes critical dependencies)
 *
 * Follows the microservices best practice `micro-use-health-checks`.
 */
@ApiTags("Health")
@Controller("health")
@AllowAnonymous()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Comprehensive health check endpoint.
   * Returns detailed status of all health indicators including:
   * - Database connectivity
   * - External API dependencies
   * - Disk space
   * - Memory usage
   */
  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: "Comprehensive health check",
    description:
      "Returns detailed health status of all components including database, external APIs, disk, and memory.",
  })
  @ApiResponse({
    status: 200,
    description: "All health checks passed",
    schema: {
      type: "object",
      properties: {
        status: { type: "string", example: "ok" },
        info: { type: "object" },
        error: { type: "object" },
        details: { type: "object" },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: "One or more health checks failed",
  })
  async check(): Promise<HealthCheckResult> {
    return this.healthService.checkAll();
  }

  /**
   * Liveness probe endpoint.
   * Used by Kubernetes to determine if the application is running.
   * Should be lightweight and not depend on external services.
   */
  @Get("live")
  @HealthCheck()
  @ApiOperation({
    summary: "Liveness probe",
    description:
      "Kubernetes liveness probe. Returns 200 if the application is running. Lightweight check with no external dependencies.",
  })
  @ApiResponse({
    status: 200,
    description: "Application is alive",
  })
  @ApiResponse({
    status: 503,
    description: "Application is not responding",
  })
  async liveness(): Promise<HealthCheckResult> {
    return this.healthService.checkLiveness();
  }

  /**
   * Readiness probe endpoint.
   * Used by Kubernetes to determine if the application is ready to receive traffic.
   * Includes checks for critical dependencies like database connectivity.
   */
  @Get("ready")
  @HealthCheck()
  @ApiOperation({
    summary: "Readiness probe",
    description:
      "Kubernetes readiness probe. Returns 200 when the application is ready to receive traffic. Includes critical dependency checks.",
  })
  @ApiResponse({
    status: 200,
    description: "Application is ready to receive traffic",
  })
  @ApiResponse({
    status: 503,
    description: "Application is not ready (dependencies unavailable)",
  })
  async readiness(): Promise<HealthCheckResult> {
    return this.healthService.checkReadiness();
  }
}
