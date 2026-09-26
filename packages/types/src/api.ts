/**
 * SHEHSWAR ONE360 - Global API Contracts
 */

export interface ResponseMeta {
  correlationId: string;
  timestamp: string;
  durationMs?: number;
  version: string;
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: ApiErrorDetail[] | Record<string, unknown>;
  correlationId: string;
  timestamp: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  meta: ResponseMeta;
  error?: ApiErrorPayload;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

export interface PaginatedMeta extends ResponseMeta {
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: PaginatedMeta;
  error?: never;
}

export interface CursorPaginationParams {
  limit?: number;
  cursor?: string;
  direction?: 'forward' | 'backward';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CursorPaginatedMeta extends ResponseMeta {
  pagination: {
    limit: number;
    nextCursor: string | null;
    prevCursor?: string | null;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface CursorPaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: CursorPaginatedMeta;
  error?: never;
}
