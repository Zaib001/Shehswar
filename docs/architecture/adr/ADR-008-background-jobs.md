# ADR-008: Background Jobs & Queue Architecture

## Status

Accepted

## Context

Enterprise operations involve heavy workloads: PDF generation, bulk Excel imports/exports, scheduled daily reports, email/SMS/WhatsApp dispatch, external tax portal sync, and asynchronous recalculations. Executing these directly in HTTP request handlers leads to gateway timeouts, thread blocking, and lost tasks if the server restarts.

## Problem

How should asynchronous background jobs be queued, processed, retried, and monitored with reliability and tenant awareness?

## Options Considered

1. **In-Process JavaScript Timers / setImmediate**:
   - _Pros_: Zero external dependencies.
   - _Cons_: Lost on crash/restart, unmonitored, memory leaks, cannot distribute load across workers.
2. **RabbitMQ / Kafka**:
   - _Pros_: Heavy enterprise messaging.
   - _Cons_: Significant operational and DevOps maintenance burden for initial workloads.
3. **BullMQ backed by Redis 7**:
   - _Pros_: Battle-tested in Node.js, supports delayed jobs, exponential backoff retries, dead-letter handling, parent/child job flows, low latency, and easy local dev via Docker.
   - _Cons_: Requires Redis persistence configuration (AOF/RDB).

## Decision

Adopt **BullMQ with Redis 7**:

1. **Queues**:
   - `notifications`: Email, SMS, WhatsApp, push.
   - `file-processing`: Excel/CSV bulk import validation and batch processing.
   - `reports`: Heavy PDF generation, aging analysis, consolidated financial exports.
   - `integrations`: External API sync (e.g. FBR e-invoicing).
2. **Standard Payload Structure**:
   All job payloads must contain `correlationId`, `organizationId`, `companyId`, `actorId`, and domain-specific data.
3. **Retry Strategy**: Default 3 to 5 attempts with exponential backoff (`delay: 1000, backoff: { type: 'exponential', delay: 2000 }`).
4. **Dead-Letter Queue (DLQ)**: Jobs exceeding maximum retries are moved to a failed state and alerted via observability.

## Reasoning

BullMQ provides full job lifecycle observability, preventing HTTP request blocking while ensuring failed jobs are logged and recoverable.

## Trade-offs

Adds Redis as a required infrastructure service.

## Consequences

- HTTP requests return immediately with `202 Accepted` or job ID for long operations.
- Background jobs retain request context for distributed logging.
