/**
 * OpenTelemetry initialization for Node.js services
 * Provides distributed tracing across services
 */

import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";

export interface TelemetryConfig {
  serviceName: string;
  serviceVersion?: string;
  otlpEndpoint?: string;
  enabled?: boolean;
}

let sdkInstance: NodeSDK | null = null;

/**
 * Initialize OpenTelemetry SDK
 * Should be called at application startup before any other imports
 */
export function initTelemetry(config: TelemetryConfig): NodeSDK | null {
  const {
    serviceName,
    serviceVersion = "1.0.0",
    otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
      "http://localhost:4318/v1/traces",
    enabled = process.env.OTEL_ENABLED !== "false",
  } = config;

  if (!enabled) {
    console.log(`[Telemetry] Disabled for ${serviceName}`);
    return null;
  }

  if (sdkInstance) {
    console.log(`[Telemetry] Already initialized for ${serviceName}`);
    return sdkInstance;
  }

  const resource = new Resource({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: serviceVersion,
  });

  const traceExporter = new OTLPTraceExporter({
    url: otlpEndpoint,
  });

  sdkInstance = new NodeSDK({
    resource,
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": {
          enabled: false,
        },
      }),
    ],
  });

  sdkInstance.start();
  console.log(`[Telemetry] Initialized for ${serviceName} → ${otlpEndpoint}`);

  return sdkInstance;
}

/**
 * Shutdown telemetry SDK gracefully
 */
export async function shutdownTelemetry(): Promise<void> {
  if (sdkInstance) {
    await sdkInstance.shutdown();
    sdkInstance = null;
    console.log("[Telemetry] Shutdown complete");
  }
}

/**
 * Get the current SDK instance
 */
export function getTelemetrySDK(): NodeSDK | null {
  return sdkInstance;
}
