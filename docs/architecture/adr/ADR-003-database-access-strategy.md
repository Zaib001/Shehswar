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
3. **Primary Key Strategy**: **UUIDv7 (RFC 9562)** time-ordered 128-bit UUIDs across all tables. Generated via `uuidv7()` from `@shehswar/shared` to maintain sequential B-tree index locality. Database columns use native PostgreSQL `UUID`. Human-readable document identifiers (e.g. `SH-PO-2026-000123`) are maintained separately through `DocumentSequence` and are never used as relational foreign keys.
4. **Numeric Precision Standards**:
   - **Money**: `DECIMAL(18, 2)` — Financial transactions, invoices, ledger entries (e.g. `1,500,000.50 PKR`).
   - **Quantity**: `DECIMAL(18, 4)` — Physical inventory weights and batch movements (e.g. `24,500.2500 KG`).
   - **Unit Cost / Rate**: `DECIMAL(18, 6)` — High-precision purchase rates, chemical ingredient costs per gram/KG (e.g. `142.345678 PKR/KG`).
   - **Percentage**: `DECIMAL(8, 4)` — Markup, yield, scrap, wastage, tax percentages (e.g. `17.5000%`).
   - **Conversion Factor**: `DECIMAL(14, 6)` — Complex UOM conversion ratios (e.g. `1000.000000 KG/Ton`, `0.020000 Bag/KG`).
   - **Composition %**: `DECIMAL(8, 4)` — BOM recipe ingredient percentages, premix micro-nutrients (e.g. `0.0250%`).
   - **Allocation Factor**: `DECIMAL(10, 6)` — Cost center, machine-hour, and overhead absorption ratios (e.g. `0.004128`).
   - Across API boundaries, decimals are serialized as strings (`serializeDecimal()`) to prevent IEEE-754 precision loss in JavaScript floating-point runtimes. In memory, arithmetic uses `Decimal.js`.
5. **Timestamp Standard**: All technical timestamps stored in UTC (`DateTime @db.Timestamptz(6)`).

## Reasoning

Guarantees sequential B-tree index performance without fragmentation, eliminates floating-point accumulation errors in costing and formulations, and provides exact financial auditability.

## Trade-offs

Decimals require more storage bytes than 32-bit floats, which is negligible compared to the cost of financial discrepancy bugs.

## Consequences

- Every migration is tracked in version control under `packages/database/prisma/migrations/`.
- No floating-point math allowed in financial services.
