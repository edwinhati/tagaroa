import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { DomainException } from "../exceptions/domain.exception";

const DOMAIN_CODE_TO_STATUS: Record<string, number> = {
  ACCOUNT_NOT_FOUND: HttpStatus.NOT_FOUND,
  BUDGET_NOT_FOUND: HttpStatus.NOT_FOUND,
  BUDGET_ITEM_NOT_FOUND: HttpStatus.NOT_FOUND,
  ACCOUNT_ACCESS_DENIED: HttpStatus.FORBIDDEN,
  BUDGET_ACCESS_DENIED: HttpStatus.FORBIDDEN,
  BUDGET_ALREADY_EXISTS: HttpStatus.CONFLICT,
  INVALID_ACCOUNT_TYPE: HttpStatus.BAD_REQUEST,
  INVALID_CURRENCY: HttpStatus.BAD_REQUEST,
  CONCURRENT_MODIFICATION: HttpStatus.CONFLICT,
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request & { requestId?: string }>();
    const response = ctx.getResponse<Response>();
    const requestId = request.requestId;

    const { status, code, title, detail } = this.resolveError(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${status} ${code}: ${detail}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`${status} ${code}: ${detail}`);
    }

    response.status(status).json({
      errors: [{ status, code, title, detail }],
      ...(requestId ? { meta: { requestId } } : {}),
    });
  }

  private resolveError(exception: unknown): {
    status: number;
    code: string;
    title: string;
    detail: string;
  } {
    if (exception instanceof DomainException) {
      const status =
        DOMAIN_CODE_TO_STATUS[exception.code] ?? HttpStatus.BAD_REQUEST;
      return {
        status,
        code: exception.code,
        title: exception.name,
        detail: exception.message,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const message =
        typeof res === "string"
          ? res
          : (res as { message?: string | string[] }).message;
      const detail = Array.isArray(message)
        ? message.join("; ")
        : (message ?? exception.message);

      return {
        status,
        code: HttpStatus[status] ?? "HTTP_ERROR",
        title: exception.name,
        detail,
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: "INTERNAL_SERVER_ERROR",
      title: "Internal Server Error",
      detail: "An unexpected error occurred",
    };
  }
}
