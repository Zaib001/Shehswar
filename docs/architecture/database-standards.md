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

- **Internal Relational Primary Keys**: **UUIDv7 (RFC 9562)** time-ordered 128-bit UUIDs across all tables.
  - _Generation_: Generated in application layer via `uuidv7()` (`@shehswar/shared`).
  - _Storage_: Native PostgreSQL `UUID` (`@id @default(uuid()) @db.Uuid`).
  - _Rationale_: Combines the distributed collision-free benefits of 128-bit UUIDs with 48-bit timestamp sequential ordering, preventing B-tree index fragmentation under heavy write workloads.
- **Human-Readable Document Numbers**: Separate business codes (e.g. `SH-PO-2026-000123`).
  - _Rationale_: Relational foreign keys must never couple to business document codes. Managed atomically by `DocumentSequence`.

---

## 4. Numeric & Precision Standards (Zero Floating-Point Inaccuracy)

IEEE-754 floating-point data types (`FLOAT`, `DOUBLE`, `REAL`, JavaScript `number`) are **strictly prohibited** in all tables representing financial or quantitative data.

| Numeric Business Concept | PostgreSQL Data Type | Precision / Scale     | Application Representation      | Business Domain Examples                                                                               |
| :----------------------- | :------------------- | :-------------------- | :------------------------------ | :----------------------------------------------------------------------------------------------------- |
| **Money**                | `DECIMAL(18, 2)`     | 18 digits, 2 decimals | `Money` (`@shehswar/shared`)    | Financial transactions, invoice totals, receivables, general ledger entries (e.g. `1,500,000.50 PKR`). |
| **Quantity**             | `DECIMAL(18, 4)`     | 18 digits, 4 decimals | `Quantity` (`@shehswar/shared`) | Physical inventory weights, silo stock, dispatch quantities (KG, Bags, Tons) (e.g. `24,500.2500 KG`).  |
| **Unit Cost / Rate**     | `DECIMAL(18, 6)`     | 18 digits, 6 decimals | `Decimal` (`decimal.js`)        | Exact procurement rates, chemical ingredient costs per gram/KG (e.g. `142.345678 PKR/KG`).             |
| **Percentage**           | `DECIMAL(8, 4)`      | 8 digits, 4 decimals  | `Decimal` (`decimal.js`)        | Markup percentage, yield percentage, scrap/wastage percentage, tax withholding (e.g. `17.5000%`).      |
| **Conversion Factor**    | `DECIMAL(14, 6)`     | 14 digits, 6 decimals | `Decimal` (`decimal.js`)        | Complex UOM conversion ratios (e.g. `1000.000000 KG/Ton`, `0.020000 Bag/KG`).                          |
| **Composition %**        | `DECIMAL(8, 4)`      | 8 digits, 4 decimals  | `Decimal` (`decimal.js`)        | BOM recipe raw-material percentages, micro-nutrients, premix vitamins (e.g. `0.0250%`).                |
| **Allocation Factor**    | `DECIMAL(10, 6)`     | 10 digits, 6 decimals | `Decimal` (`decimal.js`)        | Cost center, machine-hour, electricity, and factory overhead absorption ratios (e.g. `0.004128`).      |

### API Decimal Serialization Protocol

High-precision database decimals must not silently become unsafe JavaScript floating-point numbers when transmitted across JSON API boundaries.

- **Rule**: All Decimal fields are serialized as strings via `serializeDecimal(value, scale)`.
- **Frontend Contract**: The frontend displays formatted strings via `formatMoney()`, `formatQuantity()`, and `formatDecimal()`. Authoritative calculations are performed solely on the backend.

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
