export const MONITORING_SERVICE = Symbol("MONITORING_SERVICE");

export interface IMonitoringService {
  captureException(error: unknown, context?: Record<string, unknown>): void;
  captureMessage(
    message: string,
    level?: "info" | "warning" | "error",
    context?: Record<string, unknown>,
  ): void;
  startSpan<T>(
    name: string,
    operation: () => T | Promise<T>,
    context?: Record<string, unknown>,
  ): Promise<T>;
  setUser(userId: string, email?: string, username?: string): void;
  clearUser(): void;
  addBreadcrumb(
    message: string,
    category?: string,
    data?: Record<string, unknown>,
  ): void;
  setContext(name: string, context: Record<string, unknown>): void;
}
