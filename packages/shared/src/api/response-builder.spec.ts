/**
 * SHEHSWAR ONE360 - Response Builder Unit Tests
 */
import { describe, it, expect } from 'vitest';
import { ResponseBuilder } from './response-builder';

describe('ResponseBuilder', () => {
  it('should build a standard success envelope', () => {
    const res = ResponseBuilder.success({ user: 'admin' }, 'corr-123', 45);
    expect(res.success).toBe(true);
    expect(res.data).toEqual({ user: 'admin' });
    expect(res.meta.correlationId).toBe('corr-123');
    expect(res.meta.durationMs).toBe(45);
    expect(res.meta.version).toBe('v1');
    expect(res.meta.timestamp).toBeDefined();
  });

  it('should build an offset-paginated envelope', () => {
    const res = ResponseBuilder.paginated({
      items: [1, 2, 3],
      total: 10,
      page: 1,
      pageSize: 3,
      correlationId: 'corr-offset-1',
    });
    expect(res.success).toBe(true);
    expect(res.data).toEqual([1, 2, 3]);
    expect(res.meta.pagination.totalItems).toBe(10);
    expect(res.meta.pagination.totalPages).toBe(4);
    expect(res.meta.pagination.hasNextPage).toBe(true);
    expect(res.meta.pagination.hasPrevPage).toBe(false);
  });

  it('should build a cursor-paginated envelope for high-volume streams', () => {
    const res = ResponseBuilder.cursorPaginated({
      items: [{ id: 'evt-1' }, { id: 'evt-2' }],
      nextCursor: 'evt-2',
      prevCursor: null,
      limit: 2,
      correlationId: 'corr-cursor-1',
    });
    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(2);
    expect(res.meta.pagination.nextCursor).toBe('evt-2');
    expect(res.meta.pagination.prevCursor).toBeNull();
    expect(res.meta.pagination.hasNextPage).toBe(true);
    expect(res.meta.pagination.hasPrevPage).toBe(false);
  });

  it('should build an error envelope with details', () => {
    const res = ResponseBuilder.error({
      code: 'VALIDATION_FAILED',
      message: 'Invalid input fields',
      correlationId: 'corr-err-1',
      details: [{ field: 'email', message: 'Must be a valid email address' }],
    });
    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('VALIDATION_FAILED');
    expect(res.error?.details).toBeDefined();
    expect(res.meta.correlationId).toBe('corr-err-1');
  });
});
