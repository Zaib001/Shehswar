# ADR-010: Immutable Audit Logging Architecture

## Status

Accepted

## Context

Commercial ERP systems require an unalterable audit trail for financial accountability, ISO/QC compliance, fraud detection, and regulatory oversight. Modifications to product costs, formulas, sales prices, credit limits, batches, and ledger postings must be recorded with exact before-and-after state snapshots.

## Problem

How should audit logging be architected so that:

1. Records are immutable (no UPDATE or DELETE allowed).
2. It captures the actor, organization, company, affected entity, action, field-level diffs, IP address, and request correlation ID.
3. Modules don't write ad-hoc logging tables.

## Options Considered

1. **Ad-Hoc Custom Logs per Module**:
   - _Pros_: Custom fields.
   - _Cons_: Highly inconsistent, difficult to query centralized user activity, duplicate code.
2. **Database Change Data Capture (CDC) / Debezium**:
   - _Pros_: Automatic capture at DB level.
   - _Cons_: Does not know application context (actor ID, request correlation ID, business rationale/comments).
3. **Application-Level Immutable Audit Service (`AuditLog` table)**:
   - _Pros_: Captures application security context (actor, session, correlation ID, business action, JSON diff).
   - _Cons_: Requires services to explicitly invoke or register mutations.

## Decision

Adopt **Centralized Immutable Application-Level Audit Logging (`AuditService`)**:

1. **Table**: `audit_logs` (PostgreSQL), partitioned or indexed by `(organization_id, created_at)` and `(resource, resource_id)`.
2. **Fields**:
   - `id`, `organizationId`, `companyId`, `actorId`, `actorEmail`
   - `resource`, `resourceId`, `action`
   - `previousState` (JSON), `newState` (JSON), `changedFields` (string array)
   - `correlationId`, `ipAddress`, `userAgent`, `metadata`, `createdAt`
3. **Immutability Guarantee**: The Prisma schema and database permissions prohibit UPDATE or DELETE queries on `audit_logs`.
4. **Trigger Points**:
   - Sensitive field views (`view_cost`, `view_margin`).
   - All state transitions (`approve`, `reject`, `release_batch`).
   - Formula and price updates.
   - User permission modifications and credit limit overrides.

## Reasoning

Provides complete traceability for ISO manufacturing and financial compliance audits with zero ambiguity over who changed what and when.

## Trade-offs

Increased disk storage over time; will require partitioning and archiving strategy for historical logs after 7 years.

## Consequences

- Single, consistent audit query interface across all ERP modules.
- Non-repudiation for all sensitive business actions.
