# SHEHSWAR ONE360 — API Pagination Architecture & Strategy

## 1. Overview

In high-volume ERP systems, forcing a single pagination strategy across all datasets degrades performance and leads to incorrect business results. Shehswar ONE360 mandates two distinct pagination patterns based on data volatility and volume.

---

## 2. Offset / Page Pagination (`page` & `pageSize`)

### When to Use

- **Low-churn, bounded reference datasets** where users require random page jumping and total record counts in administrative tables:
  - User and Employee Directories
  - Chart of Accounts / GL Codes
  - Plant, Branch, and Warehouse master listings
  - System Roles and Permissions
  - Configuration settings tables

### Standard Contract

```typescript
interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    correlationId: string;
    timestamp: string;
    version: string;
    pagination: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  };
}
```

### Constraints & Caveats

- Never use offset pagination on tables with > 500,000 rows where `OFFSET N` forces PostgreSQL to scan and discard `N` rows.
- Page jumping is capped at page 100 for large collections; deeper browsing requires filtering.

---

## 3. Cursor-Based Pagination (`cursor` & `limit`)

### When to Use

- **High-volume, time-series, or high-churn datasets** where concurrent inserts/deletes cause skipped or duplicated records in page offsets:
  - Immutable Financial General Ledger entries
  - Inventory Stock Movement Ledger (Goods Receipts, Dispatches, Adjustments)
  - Security Audit Logs (`audit_logs`)
  - Domain Event Outbox records (`domain_event_outbox`)
  - Integration Webhook event queues
  - Production batch sensor & telemetry readings

### Standard Contract

```typescript
interface CursorPaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    correlationId: string;
    timestamp: string;
    version: string;
    pagination: {
      limit: number;
      nextCursor: string | null;
      prevCursor: string | null;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  };
}
```

### SQL Implementation Pattern (UUIDv7 / Timestamp Index)

```sql
-- Efficient sequential index seek using UUIDv7 time-ordering:
SELECT * FROM inventory_transactions
WHERE organization_id = $1
  AND id > $cursor
ORDER BY id ASC
LIMIT $limit;
```

Because primary keys are UUIDv7, sorting by `id` directly leverages the sequential B-tree timestamp index without requiring expensive `OFFSET` scans.
