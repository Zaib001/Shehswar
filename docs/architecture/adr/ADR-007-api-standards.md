# ADR-007: Global API Standards & Response Contracts

## Status

Accepted

## Context

Shehswar ONE360 APIs will be consumed by the web app, future mobile app, external dealer portals, webhooks, and third-party integrations (FBR e-invoicing, banks). If every module invents its own response shape and error format, client integration becomes chaotic and fragile.

## Problem

What unified contract should all REST endpoints follow for versioning, pagination, metadata, error handling, and request tracing?

## Options Considered

1. **Ad-Hoc REST**: Controllers return raw JSON arrays and arbitrary objects.
   - _Pros_: Zero boilerplate.
   - _Cons_: Inconsistent error envelopes, impossible to parse errors systematically on mobile/frontend.
2. **GraphQL**:
   - _Pros_: Flexible client queries.
   - _Cons_: Complex caching, difficult rate-limiting, complex file uploads, unnecessary overhead for ERP form processing.
3. **Structured REST with Standard Response Envelopes**:
   - Explicit versioning (`/api/v1`), unified `ApiResponse<T>`, `PaginatedResponse<T>`, and sanitized `ApiErrorPayload`.

## Decision

Adopt **Structured REST with Standard Response Envelopes**:

1. **Versioning**: URL path versioning: `/api/v1/{module}/{resource}`.
2. **Standard Success Envelope (`ApiResponse<T>`)**:
   ```json
   {
     "success": true,
     "data": { ... },
     "meta": {
       "correlationId": "019abc...",
       "timestamp": "2026-09-25T16:00:00.000Z",
       "durationMs": 42,
       "version": "v1"
     }
   }
   ```
3. **Standard Paginated Envelope (`PaginatedResponse<T>`)**:
   ```json
   {
     "success": true,
     "data": [ ... ],
     "meta": {
       "correlationId": "019abc...",
       "timestamp": "...",
       "version": "v1",
       "pagination": {
         "page": 1,
         "pageSize": 20,
         "totalItems": 150,
         "totalPages": 8,
         "hasNextPage": true,
         "hasPrevPage": false
       }
     }
   }
   ```
4. **Standard Error Contract (`ApiErrorPayload`)**:
   ```json
   {
     "success": false,
     "error": {
       "code": "ERR_INSUFFICIENT_BATCH_STOCK",
       "message": "The selected batch does not have sufficient available quantity.",
       "details": [],
       "correlationId": "019abc...",
       "timestamp": "..."
     }
   }
   ```
5. **Correlation ID**: Generated or passed via `X-Correlation-ID` and forwarded across all service logs.

## Reasoning

Enables mobile, web, and external clients to use a single API client interceptor with reliable error notifications and tracing.

## Trade-offs

Adds a slight payload wrapper overhead (`success`, `data`, `meta`).

## Consequences

- No module invents custom response wrappers.
- Global interceptor and exception filter enforce this contract automatically.
