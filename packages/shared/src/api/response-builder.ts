/**
 * SHEHSWAR ONE360 - Standard API Response Envelope Builder
 */
import {
  ApiResponse,
  PaginatedResponse,
  ResponseMeta,
  ApiErrorPayload,
  ApiErrorDetail,
} from '@shehswar/types';

export class ResponseBuilder {
  private static readonly API_VERSION = 'v1';

  private static buildMeta(correlationId: string, durationMs?: number): ResponseMeta {
    return {
      correlationId,
      timestamp: new Date().toISOString(),
      durationMs,
      version: this.API_VERSION,
    };
  }

  static success<T>(data: T, correlationId: string, durationMs?: number): ApiResponse<T> {
    return {
      success: true,
      data,
      meta: this.buildMeta(correlationId, durationMs),
    };
  }

  static paginated<T>(params: {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    correlationId: string;
    durationMs?: number;
  }): PaginatedResponse<T> {
    const totalPages = Math.ceil(params.total / params.pageSize) || 1;
    return {
      success: true,
      data: params.items,
      meta: {
        ...this.buildMeta(params.correlationId, params.durationMs),
        pagination: {
          page: params.page,
          pageSize: params.pageSize,
          totalItems: params.total,
          totalPages,
          hasNextPage: params.page < totalPages,
          hasPrevPage: params.page > 1,
        },
      },
    };
  }

  static error(params: {
    code: string;
    message: string;
    correlationId: string;
    details?: ApiErrorDetail[] | Record<string, unknown>;
  }): ApiResponse<never> {
    const errorPayload: ApiErrorPayload = {
      code: params.code,
      message: params.message,
      details: params.details,
      correlationId: params.correlationId,
      timestamp: new Date().toISOString(),
    };

    return {
      success: false,
      error: errorPayload,
      meta: this.buildMeta(params.correlationId),
    };
  }
}
