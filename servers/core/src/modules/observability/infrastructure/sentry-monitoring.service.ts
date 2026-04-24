import * as Sentry from "@sentry/nestjs";
import { IMonitoringService } from "../domain/services/monitoring-service.interface";

export class SentryMonitoringService implements IMonitoringService {
  captureException(error: unknown, context?: Record<string, unknown>): void {
    Sentry.captureException(error, {
      extra: context,
    });
  }

  captureMessage(
    message: string,
    level: "info" | "warning" | "error" = "info",
    context?: Record<string, unknown>,
  ): void {
    Sentry.captureMessage(message, {
      level,
      extra: context,
    });
  }

  async startSpan<T>(
    name: string,
    operation: () => T | Promise<T>,
    context?: Record<string, unknown>,
  ): Promise<T> {
    const attributes: Record<string, string | number | boolean> = {};
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        if (
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"
        ) {
          attributes[key] = value;
        } else if (value !== null && value !== undefined) {
          const valObj = value as { toString?: unknown };
          const isCustomToString =
            typeof valObj.toString === "function" &&
            valObj.toString !== Object.prototype.toString;

          attributes[key] = isCustomToString
            ? String(value as { toString(): string })
            : JSON.stringify(value);
        }
      }
    }

    return Sentry.startSpan(
      {
        op: "custom",
        name,
        attributes,
      },
      async () => operation(),
    );
  }

  setUser(userId: string, email?: string, username?: string): void {
    Sentry.setUser({
      id: userId,
      email,
      username,
    });
  }

  clearUser(): void {
    Sentry.setUser(null);
  }

  addBreadcrumb(
    message: string,
    category?: string,
    data?: Record<string, unknown>,
  ): void {
    Sentry.addBreadcrumb({
      message,
      category,
      data,
    });
  }

  setContext(name: string, context: Record<string, unknown>): void {
    Sentry.setContext(name, context);
  }
}
