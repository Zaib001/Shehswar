# ADR-014: Error Handling & Fault Tolerance

## Status

Accepted

## Context

Unhandled exceptions in backend services can expose raw SQL queries, table names, connection strings, and stack traces to end users. Furthermore, ambiguous error messages (e.g. "Something went wrong") make debugging production issues difficult for development teams.

## Problem

How should errors be categorized, formatted, sanitized, and logged to provide actionable client feedback while protecting system internals?

## Options Considered

1. **Default Express/NestJS Error Responses**:
   - Returns standard 500 HTML or stack trace strings in development.
   - _Risk_: Information disclosure vulnerability (CWE-209).
2. **Unified Application Error Model (`AppError`) with Global Filter**:
   - Typed error codes, HTTP status mapping, safe user messages, detailed structured logging with correlation IDs.

## Decision

Adopt **Standardized Application Error Architecture**:

1. **Error Hierarchy**:
   - `AppError`: Base operational exception with explicit `ErrorCode`, HTTP status, user-facing message, and optional details.
   - Subtypes: `badRequest()`, `unauthorized()`, `forbidden()`, `notFound()`, `conflict()`, `validationFailed()`, `internal()`.
2. **Prisma Error Translation**:
   - `P2002` (Unique constraint) -> `ERR_CONCURRENCY_CONFLICT` (409 Conflict) with sanitized field name.
   - `P2025` (Record not found) -> `ERR_NOT_FOUND` (404 Not Found).
   - `P2003` (Foreign key violation) -> `ERR_BAD_REQUEST` (400 Bad Request).
3. **Information Disclosure Prevention**:
   - Stack traces, database SQL, and raw system errors are strictly written to the internal structured logger and never sent over HTTP.
4. **Correlation Tracking**:
   - Every error response includes the request's `correlationId` so users or support agents can cross-reference server logs instantly.

## Reasoning

Protects security posture while providing deterministic, machine-readable error codes to frontend and mobile applications.

## Trade-offs

Developers must throw `AppError` or standard NestJS HTTP exceptions rather than raw strings.

## Consequences

- Clean, consistent error contracts for web and mobile.
- Zero credential or schema leakage.
