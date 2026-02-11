/**
 * Unified API Error Response Format
 * Used across all services for consistent error handling
 */

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: {
    requestId: string;
    traceId?: string;
    timestamp: string;
    service: string;
  };
}

/**
 * Standard error codes used across all services
 */
export const ErrorCodes = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  CONFLICT: "CONFLICT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  RATE_LIMITED: "RATE_LIMITED",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  BAD_REQUEST: "BAD_REQUEST",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * HTTP status codes mapped to error codes
 */
export const ErrorCodeToHttpStatus: Record<ErrorCode, number> = {
  [ErrorCodes.VALIDATION_ERROR]: 400,
  [ErrorCodes.BAD_REQUEST]: 400,
  [ErrorCodes.UNAUTHORIZED]: 401,
  [ErrorCodes.FORBIDDEN]: 403,
  [ErrorCodes.NOT_FOUND]: 404,
  [ErrorCodes.CONFLICT]: 409,
  [ErrorCodes.RATE_LIMITED]: 429,
  [ErrorCodes.INTERNAL_ERROR]: 500,
  [ErrorCodes.SERVICE_UNAVAILABLE]: 503,
};

/**
 * Custom API Error class for consistent error handling
 */
export class ApiError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.statusCode = ErrorCodeToHttpStatus[code];
    this.details = details;
  }

  /**
   * Convert error to API response format
   */
  toResponse(
    requestId: string,
    service: string,
    traceId?: string,
  ): ApiErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
      meta: {
        requestId,
        traceId,
        timestamp: new Date().toISOString(),
        service,
      },
    };
  }

  /**
   * Create a NOT_FOUND error
   */
  static notFound(resource: string, id?: string): ApiError {
    const message = id
      ? `${resource} with id '${id}' not found`
      : `${resource} not found`;
    return new ApiError(ErrorCodes.NOT_FOUND, message);
  }

  /**
   * Create a VALIDATION_ERROR
   */
  static validation(message: string, details?: unknown): ApiError {
    return new ApiError(ErrorCodes.VALIDATION_ERROR, message, details);
  }

  /**
   * Create an UNAUTHORIZED error
   */
  static unauthorized(message = "Authentication required"): ApiError {
    return new ApiError(ErrorCodes.UNAUTHORIZED, message);
  }

  /**
   * Create a FORBIDDEN error
   */
  static forbidden(message = "Access denied"): ApiError {
    return new ApiError(ErrorCodes.FORBIDDEN, message);
  }

  /**
   * Create an INTERNAL_ERROR
   */
  static internal(message = "An internal error occurred"): ApiError {
    return new ApiError(ErrorCodes.INTERNAL_ERROR, message);
  }

  /**
   * Create a RATE_LIMITED error
   */
  static rateLimited(message = "Too many requests"): ApiError {
    return new ApiError(ErrorCodes.RATE_LIMITED, message);
  }

  /**
   * Create a SERVICE_UNAVAILABLE error
   */
  static serviceUnavailable(
    message = "Service temporarily unavailable",
  ): ApiError {
    return new ApiError(ErrorCodes.SERVICE_UNAVAILABLE, message);
  }

  /**
   * Create a CONFLICT error
   */
  static conflict(message: string): ApiError {
    return new ApiError(ErrorCodes.CONFLICT, message);
  }

  /**
   * Check if an error is an ApiError
   */
  static isApiError(error: unknown): error is ApiError {
    return error instanceof ApiError;
  }

  /**
   * Convert any error to ApiError
   */
  static from(error: unknown): ApiError {
    if (ApiError.isApiError(error)) {
      return error;
    }

    if (error instanceof Error) {
      return new ApiError(ErrorCodes.INTERNAL_ERROR, error.message);
    }

    return new ApiError(
      ErrorCodes.INTERNAL_ERROR,
      "An unexpected error occurred",
    );
  }
}

/**
 * Build an error response object
 */
export function buildErrorResponse(
  error: ApiError | Error | unknown,
  requestId: string,
  service: string,
  traceId?: string,
): { response: ApiErrorResponse; statusCode: number } {
  const apiError = ApiError.from(error);
  return {
    response: apiError.toResponse(requestId, service, traceId),
    statusCode: apiError.statusCode,
  };
}
