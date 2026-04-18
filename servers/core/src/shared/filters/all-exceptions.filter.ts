import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";
import type { Request, Response } from "express";
import { DomainException } from "../exceptions/domain.exception";

const DOMAIN_CODE_TO_STATUS: Record<string, number> = {
  ACCOUNT_NOT_FOUND: HttpStatus.NOT_FOUND,
  BUDGET_NOT_FOUND: HttpStatus.NOT_FOUND,
  BUDGET_ITEM_NOT_FOUND: HttpStatus.NOT_FOUND,
  TRANSACTION_NOT_FOUND: HttpStatus.NOT_FOUND,
  ASSET_NOT_FOUND: HttpStatus.NOT_FOUND,
  LIABILITY_NOT_FOUND: HttpStatus.NOT_FOUND,
  ACCOUNT_ACCESS_DENIED: HttpStatus.FORBIDDEN,
  BUDGET_ACCESS_DENIED: HttpStatus.FORBIDDEN,
  TRANSACTION_ACCESS_DENIED: HttpStatus.FORBIDDEN,
  ASSET_ACCESS_DENIED: HttpStatus.FORBIDDEN,
  LIABILITY_ACCESS_DENIED: HttpStatus.FORBIDDEN,
  BUDGET_ALREADY_EXISTS: HttpStatus.CONFLICT,
  BUDGET_ALLOCATION_EXCEEDED: HttpStatus.BAD_REQUEST,
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

    const { status, code, title, detail, ...rest } =
      this.resolveError(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      Sentry.captureException(exception);
      // Ensure the event is sent before we continue
      Sentry.flush(2000).catch((err) =>
        this.logger.error("Failed to flush Sentry event", err),
      );
      this.logger.error(
        `${status} ${code}: ${detail}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`${status} ${code}: ${detail}`);
    }

    response.status(status).json({
      errors: [{ status, code, title, detail, ...rest }],
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

      let detail = "An error occurred";
      let validationErrors:
        | { fieldErrors: Record<string, string[]>; formErrors: string[] }
        | undefined;
      let code = HttpStatus[status] ?? "HTTP_ERROR";

      if (typeof res === "string") {
        detail = res;
      } else {
        const responseObj = res as {
          message?: string | string[];
          errors?: {
            fieldErrors: Record<string, string[]>;
            formErrors: string[];
          };
        };
        const message = responseObj.message;
        detail = Array.isArray(message)
          ? message.join("; ")
          : (message ?? exception.message);
        validationErrors = responseObj.errors;

        // Use a dedicated code for Zod validation failures
        if (validationErrors) {
          code = "VALIDATION_ERROR";
        }
      }

      return {
        status,
        code,
        title: exception.name,
        detail,
        ...(validationErrors ? { errors: validationErrors } : {}),
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
