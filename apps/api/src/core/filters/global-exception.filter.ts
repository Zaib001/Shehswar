/**
 * SHEHSWAR ONE360 - Global Exception Filter
 *
 * Intercepts all unhandled errors, formats them into the standard enterprise
 * error contract, and masks sensitive internal details/SQL traces from users.
 */
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { AppError, ErrorCode, RequestContext, ResponseBuilder } from '@shehswar/shared';
import { logger } from '@shehswar/logger';
import { Prisma } from '@shehswar/database';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const correlationId = RequestContext.getCorrelationId();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode = ErrorCode.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected internal server error occurred.';
    let details: Record<string, unknown> | Array<unknown> | undefined = undefined;

    if (exception instanceof AppError) {
      statusCode = exception.statusCode;
      errorCode = exception.code;
      message = exception.message;
      details = exception.details as Record<string, unknown> | Array<unknown> | undefined;

      if (!exception.isOperational) {
        logger.error(
          { err: exception, correlationId },
          `Non-operational AppError: ${exception.message}`,
        );
      }
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        message = (resObj['message'] as string) || exception.message;
        if (Array.isArray(resObj['message'])) {
          errorCode = ErrorCode.VALIDATION_FAILED;
          details = resObj['message'];
          message = 'Request validation failed.';
        } else {
          errorCode = (resObj['error'] as ErrorCode) || ErrorCode.BAD_REQUEST;
        }
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Safely translate Prisma errors to business error codes without leaking SQL details
      switch (exception.code) {
        case 'P2002': {
          statusCode = HttpStatus.CONFLICT;
          errorCode = ErrorCode.CONCURRENCY_CONFLICT;
          const target = (exception.meta?.target as string[])?.join(', ') || 'field';
          message = `A record with this ${target} already exists.`;
          break;
        }
        case 'P2025': {
          statusCode = HttpStatus.NOT_FOUND;
          errorCode = ErrorCode.NOT_FOUND;
          message = 'The requested entity could not be found.';
          break;
        }
        case 'P2003': {
          statusCode = HttpStatus.BAD_REQUEST;
          errorCode = ErrorCode.BAD_REQUEST;
          message = 'Operation violates relational integrity constraint.';
          break;
        }
        default: {
          statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
          errorCode = ErrorCode.INTERNAL_SERVER_ERROR;
          message = 'Database operation failed.';
          break;
        }
      }
      logger.error({ err: exception, correlationId }, `Prisma Error [${exception.code}]`);
    } else if (exception instanceof Error) {
      logger.error(
        { err: exception, correlationId },
        `Unhandled Unexpected Exception: ${exception.message}`,
      );
    } else {
      logger.error({ exception, correlationId }, 'Unknown Exception thrown');
    }

    const errorResponse = ResponseBuilder.error({
      code: errorCode,
      message,
      correlationId,
      details: details as any,
    });

    response.status(statusCode).json(errorResponse);
  }
}
