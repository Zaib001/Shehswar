# ADR-012: Event Architecture & Transactional Outbox Pattern

## Status

Accepted

## Context

When an operational entity changes state (e.g. `goods_receipt.created`, `production_batch.completed`, `intercompany_order.approved`), other modules and side-effects must react (inventory updates, notifications, background sync, ledger draft creation). If a domain service saves a record to PostgreSQL and then publishes an event to an external broker, a crash between those two steps causes an event loss (the Dual-Write Problem).

## Problem

How can domain events be published reliably with at-least-once delivery guarantees without risking inconsistency between the database state and external event listeners?

## Options Considered

1. **Direct Event Publishing After DB Commit**:
   - Save to DB, then publish to event bus.
   - _Risk_: If server restarts or broker is down, event is lost forever while DB mutation persists.
2. **Distributed 2-Phase Commit (XA Transactions)**:
   - _Risk_: Heavy performance penalty, complex configuration, poor cloud compatibility.
3. **Transactional Outbox Pattern**:
   - Write the event record to a `domain_event_outbox` table in the _same_ database transaction as the entity mutation. A background relay polls or consumes the outbox and publishes reliably.

## Decision

Adopt the **Transactional Outbox Pattern**:

1. When a domain service performs a critical transaction, it invokes `OutboxService.recordOutboxEvent(event, tx)` passing the active Prisma transaction client.
2. If the transaction commits, both the entity change and the outbox record are guaranteed to exist atomically.
3. A background worker picks up `PENDING` outbox records, dispatches them through `EventBusService`, and marks them `PUBLISHED`.
4. Event subscribers must implement idempotency (checking event ID) to handle at-least-once delivery.

## Reasoning

Eliminates the dual-write problem completely using PostgreSQL's native ACID capabilities.

## Trade-offs

Requires an outbox table and a background relay loop.

## Consequences

- Guarantees At-Least-Once domain event delivery without dual-write inconsistency.
- Idempotent consumers prevent duplicate business executions upon event replay.
- Auditability of all system events directly in PostgreSQL.
