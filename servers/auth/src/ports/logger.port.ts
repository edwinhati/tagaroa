export interface LoggerPort {
  setContext(context: string): void;
  verbose(message: unknown, context?: string): void;
  debug(message: unknown, context?: string): void;
  info(message: unknown, context?: string): void;
  log(message: unknown, context?: string): void;
  warn(message: unknown, context?: string): void;
  error(message: unknown, stack?: string, context?: string): void;
}

export interface WideEventPort {
  emit(event: Record<string, unknown>): void;
}
