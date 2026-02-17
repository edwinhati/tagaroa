/**
 * Prometheus metrics for Node.js services
 * Provides request duration, request counts, and default metrics
 */

import {
  Counter,
  collectDefaultMetrics,
  Gauge,
  Histogram,
  Registry,
} from "prom-client";

export interface MetricsConfig {
  serviceName: string;
  prefix?: string;
  collectDefault?: boolean;
}

export interface Metrics {
  registry: Registry;
  httpRequestDuration: Histogram<"method" | "route" | "status_code">;
  httpRequestsTotal: Counter<"method" | "route" | "status_code">;
  httpActiveConnections: Gauge<"method">;
}

/**
 * Create Prometheus metrics for a service
 */
export function createMetrics(config: MetricsConfig): Metrics {
  const { serviceName, prefix = "", collectDefault = true } = config;

  const registry = new Registry();
  registry.setDefaultLabels({ service: serviceName });

  if (collectDefault) {
    collectDefaultMetrics({ register: registry, prefix });
  }

  const httpRequestDuration = new Histogram({
    name: `${prefix}http_request_duration_seconds`,
    help: "Duration of HTTP requests in seconds",
    labelNames: ["method", "route", "status_code"] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [registry],
  });

  const httpRequestsTotal = new Counter({
    name: `${prefix}http_requests_total`,
    help: "Total number of HTTP requests",
    labelNames: ["method", "route", "status_code"] as const,
    registers: [registry],
  });

  const httpActiveConnections = new Gauge({
    name: `${prefix}http_active_connections`,
    help: "Number of active HTTP connections",
    labelNames: ["method"] as const,
    registers: [registry],
  });

  return {
    registry,
    httpRequestDuration,
    httpRequestsTotal,
    httpActiveConnections,
  };
}

/**
 * Helper to measure request duration
 */
export function measureRequest(
  metrics: Metrics,
  method: string,
  route: string,
  statusCode: number,
  durationMs: number,
): void {
  const durationSeconds = durationMs / 1000;
  const labels = {
    method,
    route,
    status_code: String(statusCode),
  };

  metrics.httpRequestDuration.observe(labels, durationSeconds);
  metrics.httpRequestsTotal.inc(labels);
}

/**
 * Get metrics text for Prometheus scraping
 */
export async function getMetricsText(metrics: Metrics): Promise<string> {
  return metrics.registry.metrics();
}

/**
 * Get content type for metrics response
 */
export function getMetricsContentType(metrics: Metrics): string {
  return metrics.registry.contentType;
}
