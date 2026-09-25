# SHEHSWAR ONE360 — Database Design & Precision Standards

## 1. Relational Database Engine

The primary persistence engine is **PostgreSQL 16**.
All schema definitions and migrations are managed through **Prisma ORM** located in `packages/database`.

---

## 2. Naming Conventions

| Element                | Convention                    | Example                                         |
| :--------------------- | :---------------------------- | :---------------------------------------------- |
| **Tables**             | Plural, snake_case, lowercase | `companies`, `sales_orders`, `batch_stocks`     |
| **Columns**            | snake_case, lowercase         | `created_at`, `unit_cost`, `organization_id`    |
| **Primary Keys**       | `id` (UUID string)            | `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` |
| **Foreign Keys**       | Singular entity name + `_id`  | `company_id`, `warehouse_id`, `actor_id`        |
| **Indexes**            | `idx_{table}_{column(s)}`     | `idx_sales_orders_company_id`                   |
| **Unique Constraints** | `uq_{table}_{column(s)}`      | `uq_companies_org_code`                         |

---

## 3. Entity Identifier Strategy

- **Internal Relational Primary Keys**: UUID / UUIDv7 strings (`@default(uuid()) @db.Uuid`).
  - _Rationale_: Collision-free across distributed nodes, offline mobile generation ready, prevents sequential enumeration attacks.
- **Human-Readable Document Numbers**: Separate business codes (e.g. `SH-PO-2026-000123`).
  - _Rationale_: Relational foreign keys must never couple to business document codes.

---

## 4. Numeric & Precision Standards (Zero Floating-Point Inaccuracy)

IEEE-754 floating-point data types (`FLOAT`, `DOUBLE`, `REAL`) are **strictly prohibited** in all tables representing financial or quantitative data.

| Data Domain                      | PostgreSQL Data Type | Application Value Object        | Purpose                                                                  |
| :------------------------------- | :------------------- | :------------------------------ | :----------------------------------------------------------------------- |
| **Monetary Amounts**             | `DECIMAL(18, 4)`     | `Money` (`@shehswar/shared`)    | Prevents financial drift in unit pricing, discounts, taxes, and ledgers. |
| **Inventory & Batch Quantities** | `DECIMAL(18, 4)`     | `Quantity` (`@shehswar/shared`) | Exact precision for formulas (e.g. 0.025 KG of micro-ingredients).       |
| **Percentages & Rates**          | `DECIMAL(8, 4)`      | `Decimal` (`decimal.js`)        | Accurate markup percentages and tax withholding rates (e.g. 17.5000%).   |
| **Conversion Factors**           | `DECIMAL(12, 6)`     | `Decimal` (`decimal.js`)        | Exact UOM conversions (e.g. 1 Bag = 50.000000 KG).                       |

---

## 5. Timestamp & Temporal Standards

- All technical timestamps are stored in UTC using `TIMESTAMPTZ(6)`:
  - `createdAt DateTime @default(now()) @db.Timestamptz(6)`
  - `updatedAt DateTime @updatedAt @db.Timestamptz(6)`
- Business transaction dates (e.g. `invoiceDate`, `manufacturingDate`) are stored as explicit `DATE` or `TIMESTAMPTZ` values and remain distinct from technical creation timestamps.

---

## 6. Soft Delete Policy & Immutability Rules

Soft delete (`deletedAt DateTime?`) is **NOT** applied indiscriminately to all tables:

1. **Master Records (Soft Delete Allowed)**: Products, Users, Vendors, Warehouses can be marked inactive (`deletedAt`) to preserve historical foreign key integrity.
2. **Financial Ledgers & Transactions (Soft Delete Strictly FORBIDDEN)**:
   - Invoices, Collections, General Ledger Entries, Goods Receipts, Batch Movements.
   - Once posted, these records are **immutable**.
   - Corrections must follow the **Post / Reverse / Adjust** accounting principle via reversing transactions.
