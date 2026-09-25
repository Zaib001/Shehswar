# ADR-018: Reporting & Read-Model Architecture

## Status

Accepted

## Context

ERP reporting demands complex aggregations: batch yield analysis, raw material consumption variance, stock aging, dealer receivables ledgers, and consolidated profit and loss across parent and child entities. Running heavy analytical aggregation queries directly on live OLTP transactional tables causes table locks, slow write transactions, and database saturation.

## Problem

How should reporting and analytics be structured to ensure executive dashboards and large historical reports do not degrade real-time operational transactions?

## Options Considered

1. **Direct Aggregations on Live OLTP Tables**:
   - Run `SUM()`, `AVG()`, multi-table joins on live tables during business hours.
   - _Risk_: Degrades checkout/dispatch performance, causes connection pool starvation.
2. **Immediate Full Data Warehouse (Snowflake / BigQuery)**:
   - _Pros_: Extreme scale.
   - _Cons_: Immense infrastructure cost and operational overhead before the transaction volume justifies it.
3. **CQRS Read-Models, Materialized Views & Read Replica Readiness**:
   - Separate write concerns from read queries. Use summary tables, PostgreSQL materialized views refreshed periodically, and prepare for streaming to read replicas.

## Decision

Adopt **CQRS-Aligned Read-Model Architecture**:

1. **Operational Reports (Live / Near Real-Time)**:
   - Use indexed covering queries with server-side pagination (`skip`/`take`).
   - Query limits strictly enforced (max 100 records per page).
2. **Aggregated Reports (Daily / Management Dashboards)**:
   - Populated via summary rollup tables (e.g. daily inventory snapshots, monthly sales summaries) updated by background BullMQ workers.
   - Materialized views refreshed during off-peak hours with `REFRESH MATERIALIZED VIEW CONCURRENTLY`.
3. **Read Replica Readiness**:
   - NestJS Prisma service is architected to allow routing read-only queries to a PostgreSQL read replica without modifying domain code.

## Reasoning

Provides sub-second dashboard performance without jeopardizing production order processing or goods receipts.

## Trade-offs

Summary tables introduce a slight delay (near-real-time vs instantaneous) for high-level management dashboards.

## Consequences

- Operational OLTP throughput remains protected.
- Clean path to attach an external BI/analytics warehouse later.
