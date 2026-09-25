/**
 * SHEHSWAR ONE360 - Application Error Class
 */
import { ErrorCode } from './error-codes.js';
import { ApiErrorDetail } from '@shehswar/types';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: ApiErrorDetail[] | Record<string, unknown>;
  public readonly isOperational: boolean;

  constructor(params: {
    code: ErrorCode;
    message: string;
    statusCode?: number;
    details?: ApiErrorDetail[] | Record<string, unknown>;
    isOperational?: boolean;
    cause?: Error;
  }) {
    super(params.message);
    this.name = 'AppError';
    this.code = params.code;
    this.statusCode = params.statusCode ?? 500;
    this.details = params.details;
    this.isOperational = params.isOperational ?? true;

    if (params.cause) {
      this.cause = params.cause;
    }

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(
    message: string,
    details?: ApiErrorDetail[] | Record<string, unknown>,
  ): AppError {
    return new AppError({
      code: ErrorCode.BAD_REQUEST,
      message,
      statusCode: 400,
      details,
    });
  }

  static unauthorized(
    message = 'Authentication required',
    code = ErrorCode.UNAUTHORIZED,
  ): AppError {
    return new AppError({
      code,
      message,
      statusCode: 401,
    });
  }

  static forbidden(
    message = 'Access denied for resource or context',
    code = ErrorCode.FORBIDDEN,
  ): AppError {
    return new AppError({
      code,
      message,
      statusCode: 403,
    });
  }

  static notFound(resourceName: string, identifier?: string): AppError {
    return new AppError({
      code: ErrorCode.NOT_FOUND,
      message: identifier
        ? `${resourceName} with identifier '${identifier}' was not found.`
        : `${resourceName} was not found.`,
      statusCode: 404,
    });
  }

  static conflict(message: string, code = ErrorCode.CONCURRENCY_CONFLICT): AppError {
    return new AppError({
      code,
      message,
      statusCode: 409,
    });
  }

  static validationFailed(message = 'Validation failed', details?: ApiErrorDetail[]): AppError {
    return new AppError({
      code: ErrorCode.VALIDATION_FAILED,
      message,
      statusCode: 422,
      details,
    });
  }

  static internal(message = 'An unexpected internal error occurred'): AppError {
    return new AppError({
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message,
      statusCode: 500,
      isOperational: false,
    });
  }
}
