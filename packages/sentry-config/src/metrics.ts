import * as Sentry from "@sentry/nextjs";

/**
 * Sentry Metrics API wrapper
 * Works in both Next.js (client/server) and NestJS environments
 */

export type MetricType = "count" | "gauge" | "distribution";

export interface MetricOptions {
  tags?: Record<string, string | number | boolean>;
}

/**
 * Increment a counter metric
 */
export function incrementCounter(name: string, value: number = 1): void {
  Sentry.metrics.count(name, value);
}

/**
 * Set a gauge metric (last value)
 */
export function setGauge(name: string, value: number): void {
  Sentry.metrics.gauge(name, value);
}

/**
 * Record a distribution metric (histogram)
 */
export function recordDistribution(name: string, value: number): void {
  Sentry.metrics.distribution(name, value);
}

/**
 * Convenience: time an async operation and record as distribution
 */
export async function timedOperation<T>(
  name: string,
  operation: () => Promise<T>,
): Promise<T> {
  const start = performance.now();
  try {
    return await operation();
  } finally {
    const duration = performance.now() - start;
    recordDistribution(name, duration);
  }
}

/**
 * Convenience: time a sync operation and record as distribution
 */
export function timedOperationSync<T>(name: string, operation: () => T): T {
  const start = performance.now();
  try {
    return operation();
  } finally {
    const duration = performance.now() - start;
    recordDistribution(name, duration);
  }
}
