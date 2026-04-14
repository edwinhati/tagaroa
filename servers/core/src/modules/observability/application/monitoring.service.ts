import { Inject, Injectable } from "@nestjs/common";
import type { IMonitoringService } from "../domain/monitoring-service.interface";
import { MONITORING_SERVICE } from "../domain/monitoring-service.interface";

@Injectable()
export class MonitoringService {
  constructor(
    @Inject(MONITORING_SERVICE)
    private readonly monitoring: IMonitoringService,
  ) {}

  captureException(error: unknown, context?: Record<string, unknown>): void {
    this.monitoring.captureException(error, context);
  }

  captureMessage(
    message: string,
    level?: "info" | "warning" | "error",
    context?: Record<string, unknown>,
  ): void {
    this.monitoring.captureMessage(message, level, context);
  }

  async startSpan<T>(
    name: string,
    operation: () => T | Promise<T>,
    context?: Record<string, unknown>,
  ): Promise<T> {
    return this.monitoring.startSpan(name, operation, context);
  }

  setUser(userId: string, email?: string, username?: string): void {
    this.monitoring.setUser(userId, email, username);
  }

  clearUser(): void {
    this.monitoring.clearUser();
  }

  addBreadcrumb(
    message: string,
    category?: string,
    data?: Record<string, unknown>,
  ): void {
    this.monitoring.addBreadcrumb(message, category, data);
  }

  setContext(name: string, context: Record<string, unknown>): void {
    this.monitoring.setContext(name, context);
  }
}
