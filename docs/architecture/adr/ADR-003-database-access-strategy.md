# ADR-003: Database Access Strategy & Precision Standards

## Status

Accepted

## Context

Shehswar ONE360 handles core manufacturing financials, product costing, inventory quantities, tax calculations, and intercompany settlements. Floating-point types (FLOAT, DOUBLE, REAL) in databases and JavaScript cause binary IEEE-754 precision drift (e.g., `0.1 + 0.2 = 0.30000000000000004`), which is unacceptable for accounting and regulatory audits.

## Problem

What database engine, data access tool, identifier scheme, and numeric representation must be enforced to guarantee relational consistency, zero financial drift, and type-safe schema evolution?

## Options Considered

1. **Raw SQL with node-postgres (pg)**:
   - _Pros_: Maximum control.
   - _Cons_: No compile-time typing, tedious migrations, prone to SQL injection if unparameterized.
2. **TypeORM**:
   - _Pros_: Active record pattern.
   - _Cons_: Complex relation caching bugs, unstable migrations.
3. **Prisma ORM with PostgreSQL 16**:
   - _Pros_: Schema-first modeling, generated type-safe client, robust declarative migrations, atomic transaction support.
   - _Cons_: Slightly higher memory footprint on cold start.

## Decision

1. **Database Engine**: PostgreSQL 16.
2. **ORM / Data Access**: Prisma ORM with `@shehswar/database`.
3. **Primary Key Strategy**: UUID / UUIDv7 strings for internal database primary keys. Human-readable document identifiers (e.g. `SH-PO-2026-000123`) are maintained separately through `DocumentSequence`.
4. **Numeric Precision Standard**:
   - All financial amounts (unit costs, overhead, selling prices, tax, discounts, ledger totals): `DECIMAL(18, 4)`.
   - All physical inventory/production quantities (KG, Ton, Bags, Liters): `DECIMAL(18, 4)`.
   - In application memory: manipulated exclusively through `Money` and `Quantity` value objects backed by `Decimal.js`.
5. **Timestamp Standard**: All technical timestamps stored in UTC (`DateTime @db.Timestamptz(6)`).

## Reasoning

Guarantees zero floating-point accumulation errors in inventory stock valuation, formula ingredient batching, and general ledgers.

## Trade-offs

Decimals require more storage bytes than 32-bit floats, which is negligible compared to the cost of financial discrepancy bugs.

## Consequences

- Every migration is tracked in version control under `packages/database/prisma/migrations/`.
- No floating-point math allowed in financial services.
