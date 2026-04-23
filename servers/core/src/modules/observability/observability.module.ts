import { Module, Provider } from "@nestjs/common";
import { MonitoringService } from "./application/monitoring.service";
import { MONITORING_SERVICE } from "./domain/monitoring-service.interface";
import { OpenTelemetryService } from "./infrastructure/opentelemetry.service";
import { SentryMonitoringService } from "./infrastructure/sentry-monitoring.service";
import { SentryTestController } from "./presentation/http/sentry-test.controller";

const monitoringServiceProvider: Provider = {
  provide: MONITORING_SERVICE,
  useClass: SentryMonitoringService,
};

@Module({
  providers: [
    monitoringServiceProvider,
    MonitoringService,
    OpenTelemetryService,
  ],
  controllers: [SentryTestController],
  exports: [MONITORING_SERVICE, MonitoringService, OpenTelemetryService],
})
export class ObservabilityModule {}
