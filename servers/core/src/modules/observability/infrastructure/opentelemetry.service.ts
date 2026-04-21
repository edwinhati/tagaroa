import { Injectable, Logger, OnApplicationShutdown } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import type { AppConfig } from "../../../shared/config/env.validation";

@Injectable()
export class OpenTelemetryService implements OnApplicationShutdown {
  private readonly logger = new Logger(OpenTelemetryService.name);
  private sdk: NodeSDK | null = null;
  private readonly isEnabled: boolean;
  private readonly endpoint: string;
  private readonly serviceName: string;
  private readonly headers?: Record<string, string>;

  private parseHeaders(
    headersStr?: string,
  ): Record<string, string> | undefined {
    if (!headersStr) return undefined;

    const headers: Record<string, string> = {};
    const pairs = headersStr.split(",").map((p) => p.trim());

    for (const pair of pairs) {
      const equalIndex = pair.indexOf("=");
      if (equalIndex > 0) {
        const key = pair.slice(0, equalIndex);
        const value = pair.slice(equalIndex + 1);
        headers[key] = value;
      }
    }

    return Object.keys(headers).length > 0 ? headers : undefined;
  }

  constructor(private readonly configService: ConfigService<AppConfig, true>) {
    this.isEnabled =
      this.configService.get("OTEL_ENABLED", { infer: true }) ?? false;
    this.endpoint =
      this.configService.get("OTEL_EXPORTER_OTLP_ENDPOINT", { infer: true }) ??
      "";
    this.serviceName =
      this.configService.get("OTEL_SERVICE_NAME", { infer: true }) ??
      "core-service";
    const headersStr = this.configService.get("OTEL_EXPORTER_OTLP_HEADERS", {
      infer: true,
    }) as string | undefined;
    this.headers = this.parseHeaders(headersStr);
  }

  async initialize(): Promise<void> {
    if (!this.isEnabled) {
      this.logger.log("OpenTelemetry is disabled");
      return;
    }

    this.logger.log(
      `Initializing OpenTelemetry (endpoint: ${this.endpoint}, service: ${this.serviceName})`,
    );

    const traceExporter = new OTLPTraceExporter({
      url: this.endpoint,
      headers: this.headers,
    });

    this.sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: this.serviceName,
        [ATTR_SERVICE_VERSION]: "1.0.0",
      }),
      traceExporter,
      instrumentations: [
        getNodeAutoInstrumentations({
          "@opentelemetry/instrumentation-fs": { enabled: false },
        }),
      ],
    });

    try {
      this.sdk.start();
      this.logger.log("OpenTelemetry SDK started successfully");
    } catch (error) {
      this.logger.error("Failed to start OpenTelemetry SDK:", error);
      throw error;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.sdk) {
      this.logger.log("Shutting down OpenTelemetry SDK...");
      await this.sdk.shutdown();
      this.logger.log("OpenTelemetry SDK shut down");
    }
  }
}
